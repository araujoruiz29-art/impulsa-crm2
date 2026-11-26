import { NextRequest, NextResponse } from "next/server";
import { getIntegrationSettings, prisma } from "@/lib/prisma";
import {
  fetchMetaLeadDetails,
  fetchMetaSocialProfile,
  sendMetaSocialMessage,
  sendWhatsAppCloudMessage,
  verifyMetaWebhookSignature,
} from "@/lib/meta";
import { normalizeCRPhone } from "@/lib/format";
import { runTriggerAutomations } from "@/lib/automations";
import { downloadAndTranscribeMetaAudio } from "@/lib/audio";
import { generateAiReply, qualifyLeadAndNotifySeller } from "@/lib/ai-agent";
import { downloadMetaWhatsAppImage, identifyShoeAndFetchLiveStock } from "@/lib/vision-stock";
import {
  findOrCreateWhatsAppClient,
  findOrCreateWhatsAppConversation,
  mergeDuplicateWhatsAppThreads,
} from "@/lib/conversation-merge";
import { syncCrmFromConversation } from "@/lib/crm-autopilot";

// Official Meta Webhook Verification (GET) - Multi-tenant across all workspaces
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token") || "";
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && challenge) {
    if (token === "caminante_meta_verify_2026") {
      return new NextResponse(challenge, { status: 200 });
    }
    const matched = await prisma.integrationSettings.findFirst({
      where: { metaVerifyToken: token },
      select: { id: true },
    });
    if (matched) {
      return new NextResponse(challenge, { status: 200 });
    }
  }
  return NextResponse.json({ error: "Token de verificación Meta inválido." }, { status: 403 });
}

// Official Meta Webhook Receiver (Multi-tenant: routes by phone_number_id / page_id)
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    const entries = Array.isArray(payload.entry) ? payload.entry : [];

    // Resolve target workspace from Meta phone_number_id (fallback to "default")
    let targetWorkspaceId = "default";
    const firstPhoneId = entries[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    if (firstPhoneId) {
      const matched = await prisma.integrationSettings.findFirst({
        where: { metaPhoneNumberId: String(firstPhoneId) },
        select: { id: true },
      });
      if (matched) targetWorkspaceId = matched.id;
    }

    const cfg = await getIntegrationSettings(targetWorkspaceId);
    const sig = req.headers.get("x-hub-signature-256");

    if (!verifyMetaWebhookSignature(rawBody, sig, cfg.metaAppSecret)) {
      return NextResponse.json({ error: "Firma X-Hub-Signature-256 inválida." }, { status: 401 });
    }

    for (const entry of entries) {
      // 1. WhatsApp Cloud API & Leadgen changes
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change.value || {};
        let wsId = targetWorkspaceId;
        if (value.metadata?.phone_number_id) {
          const m = await prisma.integrationSettings.findFirst({
            where: { metaPhoneNumberId: String(value.metadata.phone_number_id) },
            select: { id: true },
          });
          if (m) wsId = m.id;
        }
        const wsCfg = wsId === targetWorkspaceId ? cfg : await getIntegrationSettings(wsId);

        // A. WhatsApp inbound messages
        if (change.field === "messages" && Array.isArray(value.messages)) {
          const contacts = Array.isArray(value.contacts) ? value.contacts : [];
          for (const msg of value.messages) {
            const from = normalizeCRPhone(msg.from || "");
            if (!from) continue;

            // Skip duplicate Meta webhook retries for the exact same WhatsApp message ID
            if (msg.id) {
              const dupMsg = await prisma.message.findFirst({
                where: { externalMessageId: String(msg.id) },
                select: { id: true },
              });
              if (dupMsg) continue;
            }

            // Handle emoji reactions cleanly without creating empty chats or triggering AI
            if (msg.type === "reaction") {
              const emoji = String(msg.reaction?.emoji || "").trim();
              if (!emoji) continue; // User removed a reaction
              const existingConv = await prisma.conversation.findFirst({
                where: {
                  workspaceId: wsId,
                  channel: "WHATSAPP",
                  externalId: { in: [from, from.startsWith("506") ? from.slice(3) : from] },
                },
                orderBy: { createdAt: "asc" },
              });
              if (existingConv) {
                const reactionText = `Reaccionó ${emoji}`;
                await prisma.message.create({
                  data: {
                    conversationId: existingConv.id,
                    direction: "INBOUND",
                    senderName: contacts[0]?.profile?.name || existingConv.subject || from,
                    senderRole: "CLIENT",
                    body: reactionText,
                    externalMessageId: msg.id || "",
                    status: "DELIVERED",
                  },
                });
                await prisma.conversation.update({
                  where: { id: existingConv.id },
                  data: {
                    lastMessageAt: new Date(),
                    lastMessagePreview: reactionText,
                  },
                });
              }
              continue;
            }

            const matchedContact = contacts.find(
              (ct: { wa_id?: string }) => normalizeCRPhone(ct.wa_id || "") === from
            );
            const profileName = matchedContact?.profile?.name || contacts[0]?.profile?.name || from;
            const isAudio = msg.type === "audio" && msg.audio?.id;
            const isImage = msg.type === "image" && msg.image?.id;

            let bodyText =
              msg.text?.body ||
              msg.image?.caption ||
              msg.video?.caption ||
              msg.document?.caption ||
              msg.button?.text ||
              msg.interactive?.button_reply?.title ||
              msg.interactive?.list_reply?.title ||
              "";

            if (!bodyText) {
              if (msg.type === "document") {
                bodyText = `📄 Documento recibido: ${msg.document?.filename || "archivo"}`;
              } else if (msg.type === "video") {
                bodyText = "🎥 Video recibido";
              } else if (msg.type === "sticker") {
                bodyText = "😊 Sticker recibido";
              } else if (msg.type === "location" && msg.location) {
                bodyText = `📍 Ubicación: https://maps.google.com/?q=${msg.location.latitude},${msg.location.longitude}`;
              } else {
                bodyText = `[Archivo ${msg.type || "multimedia"}]`;
              }
            }

            let rawTextForAi = bodyText;
            let autoVisionReply = "";
            if (isAudio) {
              const audioRes = await downloadAndTranscribeMetaAudio(String(msg.audio.id));
              rawTextForAi = audioRes.transcript;
              bodyText = `🎤 [Nota de voz transcrita (${audioRes.provider})]:\n${audioRes.transcript}`;
            } else if (isImage && wsId === "default") {
              const img = await downloadMetaWhatsAppImage(String(msg.image.id));
              if (img) {
                const stockRes = await identifyShoeAndFetchLiveStock({
                  imageBytes: img.bytes,
                  mimeType: img.mimeType,
                  hintText: msg.image?.caption || "",
                });
                autoVisionReply = stockRes.whatsappReply;
                rawTextForAi = `Foto de producto enviada por cliente. ${
                  stockRes.bestMatch
                    ? `Producto identificado: ${stockRes.bestMatch.name} (${stockRes.bestMatch.sku}) - Precio ${stockRes.bestMatch.priceText}`
                    : stockRes.vision.visualSummary
                }`;
                bodyText = `📷 [Foto analizada por IA Visual]: ${
                  stockRes.bestMatch ? stockRes.bestMatch.name : stockRes.vision.visualSummary
                }${msg.image?.caption ? `\nTexto cliente: ${msg.image.caption}` : ""}`;
              }
            }

            const client = await findOrCreateWhatsAppClient(wsId, from, profileName);
            const conv = await findOrCreateWhatsAppConversation(
              wsId,
              from,
              profileName,
              client.id,
              bodyText
            );

            await prisma.message.create({
              data: {
                conversationId: conv.id,
                direction: "INBOUND",
                senderName: profileName,
                senderRole: "CLIENT",
                body: bodyText,
                externalMessageId: msg.id || "",
                status: "DELIVERED",
              },
            });

            // Re-check for any concurrent duplicate threads created in the same millisecond
            await mergeDuplicateWhatsAppThreads(wsId).catch(() => {});
            const canonicalConv =
              (await prisma.conversation.findFirst({
                where: { workspaceId: wsId, channel: "WHATSAPP", externalId: from },
                orderBy: { createdAt: "asc" },
              })) || conv;
            const targetClientId = canonicalConv.clientId || client.id;
            const targetClient =
              targetClientId === client.id
                ? client
                : (await prisma.client.findUnique({ where: { id: targetClientId } })) || client;

            // Auto-stop any active 1-7-90 follow-up sequence since the customer replied!
            await prisma.sequenceEnrollment
              .updateMany({
                where: {
                  workspaceId: wsId,
                  clientId: targetClientId,
                  status: "ACTIVA",
                },
                data: { status: "DETENIDA_RESPUESTA" },
              })
              .catch(() => {});

            // 1. Coworkers / Agents / Suppliers (INTERNO / PROVEEDOR): NEVER trigger AI, Alerts, or Kanban autopilot
            const isExcludedFromAi = targetClient.contactType !== "CLIENTE";
            if (isExcludedFromAi) {
              if (canonicalConv.aiEnabled) {
                await prisma.conversation.update({
                  where: { id: canonicalConv.id },
                  data: { aiEnabled: false },
                });
              }
              continue;
            }

            // 2. "IA solo para Clientes Nuevos": skip auto-reply if client is already past NUEVO stage
            const skipAiForExistingClient =
              Boolean(wsCfg.aiOnlyNewClients) && targetClient.stage !== "NUEVO";

            await qualifyLeadAndNotifySeller({
              clientId: targetClientId,
              conversationId: canonicalConv.id,
              messageBody: rawTextForAi,
              isAudio: Boolean(isAudio),
            });

            if (
              autoVisionReply &&
              canonicalConv.aiEnabled &&
              !wsCfg.aiGlobalPaused &&
              !skipAiForExistingClient
            ) {
              const waRes = await sendWhatsAppCloudMessage({
                workspaceId: wsId,
                to: from,
                text: autoVisionReply,
              });
              await prisma.message.create({
                data: {
                  conversationId: canonicalConv.id,
                  direction: "OUTBOUND",
                  senderName: "Agente Visual + Stock Web",
                  senderRole: "AI",
                  body: autoVisionReply,
                  status: waRes.simulated ? "SIMULATED" : waRes.ok ? "SENT" : "FAILED",
                },
              });
              await prisma.conversation.update({
                where: { id: canonicalConv.id },
                data: {
                  lastMessageAt: new Date(),
                  lastMessagePreview: autoVisionReply.slice(0, 140),
                },
              });
            } else if (!wsCfg.aiGlobalPaused && !skipAiForExistingClient) {
              await runTriggerAutomations("NEW_WHATSAPP_MESSAGE", {
                workspaceId: wsId,
                clientId: targetClientId,
                conversationId: canonicalConv.id,
                messageBody: rawTextForAi,
                channel: "WHATSAPP",
              });
            }

            // Silent CRM Autopilot: updates Kanban stage, tags, summary & Agenda tasks even in Manual Mode
            await syncCrmFromConversation(canonicalConv.id, wsId).catch((e) =>
              console.error("Silent CRM autopilot webhook error:", e)
            );
          }
        }

        // B. Meta Lead Ads (Facebook / Instagram Forms)
        if (change.field === "leadgen" && value.leadgen_id) {
          let leadWsId = wsId;
          if (entry.id) {
            const pageMatch = await prisma.integrationSettings.findFirst({
              where: { metaPageId: String(entry.id) },
              select: { id: true },
            });
            if (pageMatch) leadWsId = pageMatch.id;
          }
          const leadCfg = leadWsId === wsId ? wsCfg : await getIntegrationSettings(leadWsId);
          const leadDetails = await fetchMetaLeadDetails(value.leadgen_id, leadCfg.metaAccessToken);
          const fields: Record<string, string> = {};
          if (leadDetails?.field_data) {
            for (const f of leadDetails.field_data) {
              fields[f.name] = Array.isArray(f.values) ? f.values[0] : "";
            }
          }
          const name = fields.full_name || fields.nombre || "Lead Meta Ads";
          const phone = normalizeCRPhone(fields.phone_number || fields.telefono || "");
          const email = fields.email || "";
          const companyName = fields.company_name || fields.empresa || name;

          const client = await prisma.client.create({
            data: {
              workspaceId: leadWsId,
              company: companyName,
              contactName: name,
              phone,
              whatsapp: phone,
              email,
              stage: "NUEVO",
              source: "META_ADS",
              metaLeadId: String(value.leadgen_id),
              metaCampaign: String(value.ad_id || "Meta Lead Ads"),
              notes: `Formulario Meta Lead Ads recibido (${JSON.stringify(fields)})`,
            },
          });

          const conv = await prisma.conversation.create({
            data: {
              workspaceId: leadWsId,
              channel: "WHATSAPP",
              externalId: phone || String(value.leadgen_id),
              subject: `Lead Meta Ads - ${companyName}`,
              clientId: client.id,
              unreadCount: 1,
              lastMessagePreview: `Nuevo lead de Meta Ads: ${name}`,
            },
          });

          await prisma.message.create({
            data: {
              conversationId: conv.id,
              direction: "INBOUND",
              senderName: name,
              senderRole: "CLIENT",
              body: `Nuevo formulario de Meta Lead Ads recibido.\nContacto: ${name}\nTel: ${phone}\nCorreo: ${email}`,
              status: "DELIVERED",
            },
          });

          await runTriggerAutomations("NEW_META_LEAD", {
            workspaceId: leadWsId,
            clientId: client.id,
            conversationId: conv.id,
            channel: "WHATSAPP",
          });
        }
      }

      // 2. Facebook Messenger / Instagram DM messaging array (Multi-tenant by Page ID / IG ID)
      const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
      let msgWsId = targetWorkspaceId;
      if (messaging.length > 0 && entry.id) {
        const socialMatch = await prisma.integrationSettings.findFirst({
          where: {
            OR: [
              { metaPageId: String(entry.id) },
              { metaIgAccountId: String(entry.id) },
            ],
          },
          select: { id: true },
        });
        if (socialMatch) msgWsId = socialMatch.id;
      }
      const socialCfg =
        messaging.length > 0 ? await getIntegrationSettings(msgWsId) : null;
      const socialToken =
        (socialCfg?.metaPageAccessToken || socialCfg?.metaAccessToken || "").trim();

      for (const ev of messaging) {
        // Skip echo messages (sent by the Page/IG itself) and non-message events
        if (ev.message?.is_echo) continue;
        if (!ev.message && !ev.postback) continue;

        const senderId = String(ev.sender?.id || "").trim();
        if (!senderId) continue;

        // Deduplicate Meta retries by message mid
        const externalMid = String(ev.message?.mid || "");
        if (externalMid) {
          const dupSocial = await prisma.message.findFirst({
            where: { externalMessageId: externalMid },
            select: { id: true },
          });
          if (dupSocial) continue;
        }

        const channel: "INSTAGRAM" | "FACEBOOK" =
          payload.object === "instagram" ? "INSTAGRAM" : "FACEBOOK";

        let bodyText = String(ev.message?.text || ev.postback?.title || "").trim();
        if (!bodyText && Array.isArray(ev.message?.attachments) && ev.message.attachments.length > 0) {
          const attType = String(ev.message.attachments[0]?.type || "archivo");
          const mapType: Record<string, string> = {
            image: "📷 Imagen recibida",
            audio: "🎤 Audio recibido",
            video: "🎥 Video recibido",
            file: "📄 Archivo recibido",
            ig_reel: "🎬 Reel compartido",
            share: "🔗 Publicación compartida",
            story_mention: "📲 Te mencionó en una historia",
          };
          bodyText = mapType[attType] || `[Archivo ${attType}]`;
        }
        if (!bodyText) continue;

        let client = await prisma.client.findFirst({
          where: { workspaceId: msgWsId, code: senderId },
        });

        const needsName =
          !client ||
          client.contactName.startsWith("Usuario ") ||
          client.company.startsWith("FACEBOOK ") ||
          client.company.startsWith("INSTAGRAM ");

        const profile = needsName
          ? await fetchMetaSocialProfile(senderId, channel, socialToken)
          : null;

        const displayName =
          profile?.name ||
          (channel === "INSTAGRAM" ? `Instagram ${senderId.slice(-4)}` : `Messenger ${senderId.slice(-4)}`);

        if (!client) {
          client = await prisma.client.create({
            data: {
              workspaceId: msgWsId,
              code: senderId,
              company: displayName,
              contactName: profile?.username ? `${displayName} (@${profile.username})` : displayName,
              stage: "NUEVO",
              source: channel,
            },
          });
        } else if (profile?.name) {
          client = await prisma.client.update({
            where: { id: client.id },
            data: {
              company: profile.name,
              contactName: profile.username ? `${profile.name} (@${profile.username})` : profile.name,
            },
          });
        }

        let conv = await prisma.conversation.findFirst({
          where: { workspaceId: msgWsId, channel, externalId: senderId },
          orderBy: { createdAt: "asc" },
        });
        if (!conv) {
          conv = await prisma.conversation.create({
            data: {
              workspaceId: msgWsId,
              channel,
              externalId: senderId,
              subject: client.company,
              clientId: client.id,
              unreadCount: 1,
              lastMessageAt: new Date(),
              lastMessagePreview: bodyText.slice(0, 140),
            },
          });
        } else {
          conv = await prisma.conversation.update({
            where: { id: conv.id },
            data: {
              subject: client.company,
              unreadCount: { increment: 1 },
              lastMessageAt: new Date(),
              lastMessagePreview: bodyText.slice(0, 140),
            },
          });
        }

        await prisma.message.create({
          data: {
            conversationId: conv.id,
            direction: "INBOUND",
            senderName: client.contactName || client.company,
            senderRole: "CLIENT",
            body: bodyText,
            externalMessageId: externalMid,
            status: "DELIVERED",
          },
        });

        // Auto-stop any active 1-7-90 follow-up sequence on inbound reply
        await prisma.sequenceEnrollment
          .updateMany({
            where: { workspaceId: msgWsId, clientId: client.id, status: "ACTIVA" },
            data: { status: "DETENIDA_RESPUESTA" },
          })
          .catch(() => {});

        // 1. Exclude coworkers / suppliers (Sin IA)
        if (client.contactType !== "CLIENTE") {
          if (conv.aiEnabled) {
            await prisma.conversation.update({
              where: { id: conv.id },
              data: { aiEnabled: false },
            });
          }
          continue;
        }

        // 2. Qualify purchase intent vs general inquiry & alert seller if ready to buy
        await qualifyLeadAndNotifySeller({
          clientId: client.id,
          conversationId: conv.id,
          messageBody: bodyText,
          isAudio: false,
        });

        // Reload conv in case qualifyLeadAndNotifySeller paused AI for hot lead
        const latestConv =
          (await prisma.conversation.findUnique({
            where: { id: conv.id },
            include: { messages: { orderBy: { createdAt: "asc" }, take: 10 } },
          })) || null;

        const skipAiForExisting =
          Boolean(socialCfg?.aiOnlyNewClients) && client.stage !== "NUEVO";

        if (
          latestConv &&
          latestConv.aiEnabled &&
          !socialCfg?.aiGlobalPaused &&
          !skipAiForExisting
        ) {
          const ai = await generateAiReply({
            workspaceId: msgWsId,
            userMessage: bodyText,
            channel,
            clientName: client.contactName || client.company,
            clientCompany: client.company,
            conversationHistory: latestConv.messages.map((m) => ({
              role: m.direction === "INBOUND" ? "Cliente" : "Asistente",
              body: m.body,
            })),
          });
          const sendRes = await sendMetaSocialMessage({
            workspaceId: msgWsId,
            channel,
            recipientId: senderId,
            text: ai.reply,
          });
          await prisma.message.create({
            data: {
              conversationId: conv.id,
              direction: "OUTBOUND",
              senderName: "Agente IA",
              senderRole: "AI",
              body: ai.reply,
              externalMessageId: sendRes.externalMessageId || "",
              status: sendRes.simulated ? "SIMULATED" : sendRes.ok ? "SENT" : "FAILED",
            },
          });
          await prisma.conversation.update({
            where: { id: conv.id },
            data: {
              lastMessageAt: new Date(),
              lastMessagePreview: ai.reply.slice(0, 140),
            },
          });
        }

        // 3. Silent CRM Autopilot: organizes Kanban stage, tags, summary & Agenda tasks automatically!
        await syncCrmFromConversation(conv.id, msgWsId).catch((e) =>
          console.error("Silent CRM autopilot social error:", e)
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Meta webhook error:", err);
    return NextResponse.json({ error: "Error procesando webhook Meta" }, { status: 500 });
  }
}
