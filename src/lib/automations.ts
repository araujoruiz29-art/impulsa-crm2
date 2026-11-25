import { getIntegrationSettings, prisma } from "./prisma";
import { formatMoney } from "./format";
import { generateAiReply } from "./ai-agent";
import { sendWhatsAppCloudMessage } from "./meta";
import { sendCorporateEmail } from "./email";

export interface TriggerContext {
  clientId?: string;
  conversationId?: string;
  quoteId?: string;
  messageBody?: string;
  channel?: string;
}

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function runTriggerAutomations(trigger: string, ctx: TriggerContext) {
  const rules = await prisma.automationRule.findMany({
    where: { trigger, active: true },
  });

  const executed: string[] = [];

  const client = ctx.clientId
    ? await prisma.client.findUnique({ where: { id: ctx.clientId } })
    : null;
  const quote = ctx.quoteId
    ? await prisma.quote.findUnique({ where: { id: ctx.quoteId } })
    : null;

  const vars: Record<string, string> = {
    contacto: client?.contactName || client?.company || "cliente",
    empresa: client?.company || "",
    numero: quote ? String(quote.number) : "",
    total: quote ? formatMoney(quote.total, quote.currency) : "",
  };

  for (const rule of rules) {
    try {
      let summary = "";

      if (rule.actionType === "MOVE_STAGE" && client && rule.targetStage) {
        await prisma.client.update({
          where: { id: client.id },
          data: { stage: rule.targetStage },
        });
        await prisma.activity.create({
          data: {
            clientId: client.id,
            quoteId: quote?.id,
            type: "AUTOMATIZACION",
            title: `Etapa actualizada a ${rule.targetStage}`,
            description: rule.templateText || rule.name,
            completed: true,
          },
        });
        summary = `Cliente ${client.company} movido a ${rule.targetStage}.`;
      } else if (rule.actionType === "AI_REPLY" && ctx.conversationId && ctx.messageBody) {
        const cfg = await getIntegrationSettings();
        const conv = await prisma.conversation.findUnique({
          where: { id: ctx.conversationId },
          include: { messages: { orderBy: { createdAt: "asc" }, take: 10 } },
        });
        if (cfg.aiGlobalPaused) {
          summary = "Omitido: CRM en Modo Manual Total (IA global pausada).";
        } else if (conv && conv.aiEnabled) {
          const ai = await generateAiReply({
            userMessage: ctx.messageBody,
            channel: conv.channel,
            clientName: client?.contactName || client?.company,
            clientCompany: client?.company,
            conversationHistory: conv.messages.map((m) => ({
              role: m.direction === "INBOUND" ? "Cliente" : "Asistente",
              body: m.body,
            })),
          });

          let status = "SIMULATED";
          if (conv.channel === "WHATSAPP" && conv.externalId) {
            const waRes = await sendWhatsAppCloudMessage({
              to: conv.externalId,
              text: ai.reply,
            });
            status = waRes.simulated ? "SIMULATED" : waRes.ok ? "SENT" : "FAILED";
          }

          await prisma.message.create({
            data: {
              conversationId: conv.id,
              direction: "OUTBOUND",
              senderName: "Agente IA Caminante",
              senderRole: "AI",
              body: ai.reply,
              status,
            },
          });

          // Send up to 3 real product photos from elcaminantecr.com/tienda/ when customer asked about products/photos!
          if (conv.channel === "WHATSAPP" && conv.externalId && ai.storePhotos && ai.storePhotos.length > 0) {
            for (const photo of ai.storePhotos.slice(0, 3)) {
              const caption = `*${photo.name}* (Ref: ${photo.sku})\n💰 ${photo.priceText} IVA incl.\n📏 ${photo.sizesSummary}\n🔗 ${photo.url}`;
              const imgRes = await sendWhatsAppCloudMessage({
                to: conv.externalId,
                text: caption,
                imageUrl: photo.imageUrl,
              });
              await prisma.message.create({
                data: {
                  conversationId: conv.id,
                  direction: "OUTBOUND",
                  senderName: "Catálogo Web · Fotos",
                  senderRole: "AI",
                  body: caption,
                  attachmentName: photo.name,
                  attachmentUrl: photo.imageUrl,
                  status: imgRes.simulated ? "SIMULATED" : imgRes.ok ? "SENT" : "FAILED",
                },
              });
            }
          }

          await prisma.conversation.update({
            where: { id: conv.id },
            data: {
              lastMessageAt: new Date(),
              lastMessagePreview: ai.reply.slice(0, 140),
            },
          });

          summary = `Agente IA respondió automáticamente (${ai.mode})${
            ai.storePhotos?.length ? ` + ${ai.storePhotos.length} foto(s) de la tienda` : ""
          }.`;
        } else {
          summary = "Omitido: IA pausada en esta conversación.";
        }
      } else if (rule.actionType === "SEND_TEMPLATE" && client) {
        const text = renderTemplate(rule.templateText, vars);
        if ((rule.channel === "WHATSAPP" || rule.channel === "ALL") && (client.whatsapp || client.phone)) {
          await sendWhatsAppCloudMessage({ to: client.whatsapp || client.phone, text });
        }
        if (ctx.conversationId) {
          await prisma.message.create({
            data: {
              conversationId: ctx.conversationId,
              direction: "OUTBOUND",
              senderName: "Automatización CRM",
              senderRole: "SYSTEM",
              body: text,
              status: "SIMULATED",
            },
          });
        }
        if (rule.targetStage) {
          await prisma.client.update({
            where: { id: client.id },
            data: { stage: rule.targetStage },
          });
        }
        summary = `Plantilla enviada a ${client.company}.`;
      } else if (rule.actionType === "CREATE_TASK" && client) {
        await prisma.activity.create({
          data: {
            clientId: client.id,
            quoteId: quote?.id,
            type: "TAREA",
            title: renderTemplate(rule.templateText || rule.name, vars),
            dueDate: new Date(Date.now() + Math.max(24, rule.delayHours) * 3600 * 1000),
            completed: false,
          },
        });
        summary = `Tarea de seguimiento creada para ${client.company}.`;
      } else {
        summary = `Regla evaluada: ${rule.name}`;
      }

      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { runCount: { increment: 1 }, lastRunAt: new Date() },
      });

      await prisma.automationLog.create({
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          clientId: client?.id,
          trigger,
          status: "SUCCESS",
          summary,
        },
      });
      executed.push(summary);
    } catch (err) {
      await prisma.automationLog.create({
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          clientId: client?.id,
          trigger,
          status: "ERROR",
          summary: err instanceof Error ? err.message : "Error desconocido",
        },
      });
    }
  }

  return executed;
}

export async function runScheduledFollowUps() {
  const rules = await prisma.automationRule.findMany({
    where: { trigger: "QUOTE_NO_RESPONSE", active: true },
  });

  const results: string[] = [];

  for (const rule of rules) {
    const cutoff = new Date(Date.now() - Math.max(1, rule.delayHours) * 3600 * 1000);
    const pendingQuotes = await prisma.quote.findMany({
      where: {
        status: "ENVIADA",
        sentAt: { lte: cutoff },
        OR: [{ lastFollowUpAt: null }, { lastFollowUpAt: { lte: cutoff } }],
      },
      include: { client: true },
      take: 25,
    });

    for (const q of pendingQuotes) {
      if (q.client?.optOut) continue;
      const vars = {
        contacto: q.clientContact || q.clientCompany,
        empresa: q.clientCompany,
        numero: String(q.number),
        total: formatMoney(q.total, q.currency),
      };
      const text = renderTemplate(rule.templateText, vars);

      if ((rule.channel === "WHATSAPP" || rule.channel === "ALL") && q.clientPhone) {
        await sendWhatsAppCloudMessage({ to: q.clientPhone, text });
      }
      if ((rule.channel === "EMAIL" || rule.channel === "ALL") && q.clientEmail) {
        await sendCorporateEmail({
          to: q.clientEmail,
          subject: `Seguimiento Proforma #${q.number} - Caminante Corporativo`,
          text,
        });
      }

      await prisma.quote.update({
        where: { id: q.id },
        data: { status: "SEGUIMIENTO", lastFollowUpAt: new Date() },
      });

      if (q.clientId) {
        if (rule.targetStage) {
          await prisma.client.update({
            where: { id: q.clientId },
            data: { stage: rule.targetStage },
          });
        }
        await prisma.activity.create({
          data: {
            clientId: q.clientId,
            quoteId: q.id,
            type: "AUTOMATIZACION",
            title: `Seguimiento automático enviado para Proforma #${q.number}`,
            description: text,
            completed: true,
          },
        });
      }

      const summary = `Seguimiento enviado a ${q.clientCompany} (Proforma #${q.number})`;
      results.push(summary);

      await prisma.automationLog.create({
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          clientId: q.clientId,
          trigger: "QUOTE_NO_RESPONSE",
          status: "SUCCESS",
          summary,
        },
      });
    }

    if (pendingQuotes.length > 0) {
      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { runCount: { increment: pendingQuotes.length }, lastRunAt: new Date() },
      });
    }
  }

  return results;
}
