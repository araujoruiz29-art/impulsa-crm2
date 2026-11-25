import { NextRequest, NextResponse } from "next/server";
import { getIntegrationSettings, prisma } from "@/lib/prisma";
import { fetchMetaLeadDetails, verifyMetaWebhookSignature } from "@/lib/meta";
import { normalizeCRPhone } from "@/lib/format";
import { runTriggerAutomations } from "@/lib/automations";
import { downloadAndTranscribeMetaAudio } from "@/lib/audio";
import { qualifyLeadAndNotifySeller } from "@/lib/ai-agent";
import { downloadMetaWhatsAppImage, identifyShoeAndFetchLiveStock } from "@/lib/vision-stock";
import { sendWhatsAppCloudMessage } from "@/lib/meta";

// Official Meta Webhook Verification (GET)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const cfg = await getIntegrationSettings();
  const expectedToken = cfg.metaVerifyToken || "caminante_meta_verify_2026";

  if (mode === "subscribe" && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Token de verificación Meta inválido." }, { status: 403 });
}

// Official Meta Webhook Receiver (WhatsApp Cloud API, Messenger/IG, Lead Ads)
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const cfg = await getIntegrationSettings();
    const sig = req.headers.get("x-hub-signature-256");

    if (!verifyMetaWebhookSignature(rawBody, sig, cfg.metaAppSecret)) {
      return NextResponse.json({ error: "Firma X-Hub-Signature-256 inválida." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const entries = Array.isArray(payload.entry) ? payload.entry : [];

    for (const entry of entries) {
      // 1. WhatsApp Cloud API & Leadgen changes
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change.value || {};

        // A. WhatsApp inbound messages
        if (change.field === "messages" && Array.isArray(value.messages)) {
          const contacts = Array.isArray(value.contacts) ? value.contacts : [];
          for (const msg of value.messages) {
            const from = normalizeCRPhone(msg.from || "");
            const profileName = contacts[0]?.profile?.name || from;
            const isAudio = msg.type === "audio" && msg.audio?.id;
            const isImage = msg.type === "image" && msg.image?.id;
            let bodyText =
              msg.text?.body ||
              msg.image?.caption ||
              msg.button?.text ||
              msg.interactive?.button_reply?.title ||
              `[Archivo ${msg.type || "multimedia"}]`;

            let rawTextForAi = bodyText;
            let autoVisionReply = "";
            if (isAudio) {
              const audioRes = await downloadAndTranscribeMetaAudio(String(msg.audio.id));
              rawTextForAi = audioRes.transcript;
              bodyText = `🎤 [Nota de voz transcrita (${audioRes.provider})]:\n${audioRes.transcript}`;
            } else if (isImage) {
              const img = await downloadMetaWhatsAppImage(String(msg.image.id));
              if (img) {
                const stockRes = await identifyShoeAndFetchLiveStock({
                  imageBytes: img.bytes,
                  mimeType: img.mimeType,
                  hintText: msg.image?.caption || "",
                });
                autoVisionReply = stockRes.whatsappReply;
                rawTextForAi = `Foto de calzado enviada por cliente. ${
                  stockRes.bestMatch
                    ? `Modelo identificado: ${stockRes.bestMatch.name} (${stockRes.bestMatch.sku}) - Precio ${stockRes.bestMatch.priceText}`
                    : stockRes.vision.visualSummary
                }`;
                bodyText = `📷 [Foto analizada por IA Visual]: ${
                  stockRes.bestMatch ? stockRes.bestMatch.name : stockRes.vision.visualSummary
                }${msg.image?.caption ? `\nTexto cliente: ${msg.image.caption}` : ""}`;
              }
            }

            let client = await prisma.client.findFirst({
              where: { OR: [{ whatsapp: from }, { phone: from }] },
            });
            if (!client) {
              client = await prisma.client.create({
                data: {
                  company: profileName,
                  contactName: profileName,
                  phone: from,
                  whatsapp: from,
                  stage: "NUEVO",
                  source: "WHATSAPP",
                  notes: "Capturado automáticamente desde WhatsApp Cloud API.",
                },
              });
            }

            let conv = await prisma.conversation.findFirst({
              where: { channel: "WHATSAPP", externalId: from },
            });
            if (!conv) {
              conv = await prisma.conversation.create({
                data: {
                  channel: "WHATSAPP",
                  externalId: from,
                  subject: profileName,
                  clientId: client.id,
                  unreadCount: 1,
                  lastMessageAt: new Date(),
                  lastMessagePreview: bodyText.slice(0, 140),
                },
              });
            } else {
              await prisma.conversation.update({
                where: { id: conv.id },
                data: {
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
                senderName: profileName,
                senderRole: "CLIENT",
                body: bodyText,
                externalMessageId: msg.id || "",
                status: "DELIVERED",
              },
            });

            await qualifyLeadAndNotifySeller({
              clientId: client.id,
              conversationId: conv.id,
              messageBody: rawTextForAi,
              isAudio: Boolean(isAudio),
            });

            if (autoVisionReply && conv.aiEnabled) {
              const waRes = await sendWhatsAppCloudMessage({ to: from, text: autoVisionReply });
              await prisma.message.create({
                data: {
                  conversationId: conv.id,
                  direction: "OUTBOUND",
                  senderName: "Agente Visual + Stock Web",
                  senderRole: "AI",
                  body: autoVisionReply,
                  status: waRes.simulated ? "SIMULATED" : waRes.ok ? "SENT" : "FAILED",
                },
              });
              await prisma.conversation.update({
                where: { id: conv.id },
                data: {
                  lastMessageAt: new Date(),
                  lastMessagePreview: autoVisionReply.slice(0, 140),
                },
              });
            } else {
              await runTriggerAutomations("NEW_WHATSAPP_MESSAGE", {
                clientId: client.id,
                conversationId: conv.id,
                messageBody: rawTextForAi,
                channel: "WHATSAPP",
              });
            }
          }
        }

        // B. Meta Lead Ads (Facebook / Instagram Forms)
        if (change.field === "leadgen" && value.leadgen_id) {
          const leadDetails = await fetchMetaLeadDetails(value.leadgen_id, cfg.metaAccessToken);
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
            clientId: client.id,
            conversationId: conv.id,
            channel: "WHATSAPP",
          });
        }
      }

      // 2. Facebook Messenger / Instagram DM messaging array
      const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
      for (const ev of messaging) {
        if (!ev.message?.text) continue;
        const senderId = String(ev.sender?.id || "");
        const channel = payload.object === "instagram" ? "INSTAGRAM" : "FACEBOOK";
        const bodyText = String(ev.message.text);

        let client = await prisma.client.findFirst({ where: { code: senderId } });
        if (!client) {
          client = await prisma.client.create({
            data: {
              code: senderId,
              company: `${channel} ${senderId.slice(-4)}`,
              contactName: `Usuario ${channel}`,
              stage: "NUEVO",
              source: channel,
            },
          });
        }

        let conv = await prisma.conversation.findFirst({
          where: { channel, externalId: senderId },
        });
        if (!conv) {
          conv = await prisma.conversation.create({
            data: {
              channel,
              externalId: senderId,
              subject: client.company,
              clientId: client.id,
              unreadCount: 1,
              lastMessagePreview: bodyText.slice(0, 140),
            },
          });
        }

        await prisma.message.create({
          data: {
            conversationId: conv.id,
            direction: "INBOUND",
            senderName: client.contactName,
            senderRole: "CLIENT",
            body: bodyText,
            externalMessageId: ev.message.mid || "",
            status: "DELIVERED",
          },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Meta webhook error:", err);
    return NextResponse.json({ error: "Error procesando webhook Meta" }, { status: 500 });
  }
}
