import { NextRequest, NextResponse } from "next/server";
import { getCompanySettings, getIntegrationSettings, prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { normalizeCRPhone } from "@/lib/format";
import { sendWhatsAppCloudMessage } from "@/lib/meta";

const PRESET_1_7_90_STEPS = (brandName: string) => [
  {
    stepOrder: 0,
    dayOffset: 1,
    phase: "CORTO",
    title: "Confirmar recepción de cotización",
    messageText:
      "¡Hola {{contacto}}! Te saludamos de " +
      brandName +
      ". ¿Pudiste revisar la información/proforma que te compartimos? Con gusto te aclaramos cualquier duda de tallas, bordado o entrega.",
  },
  {
    stepOrder: 1,
    dayOffset: 3,
    phase: "CORTO",
    title: "Mostrar cómo trabajamos / calidad",
    messageText:
      "Hola {{contacto}} 👋 Solo pasaba a recordarte que en " +
      brandName +
      " trabajamos con garantía de calidad, entrega puntual y precios con IVA incluido o desglosado según lo necesiten.",
  },
  {
    stepOrder: 2,
    dayOffset: 4,
    phase: "CORTO",
    title: "Preguntas frecuentes antes de decidir",
    messageText:
      "Hola {{contacto}}, esto es lo que más nos consultan antes de confirmar: aceptamos SINPE Móvil, transferencia bancaria (BN, BCR, BAC, Davivienda) y enviamos a todo el país. ¿Te ayudo con algún ajuste?",
  },
  {
    stepOrder: 3,
    dayOffset: 5,
    phase: "CORTO",
    title: "Ayudar a decidir",
    messageText:
      "¡Hola {{contacto}}! ¿Qué te falta para tomar la decisión con tu pedido? Si necesitas ajustar cantidades, modelos o presupuesto, podemos revisarlo hoy mismo.",
  },
  {
    stepOrder: 4,
    dayOffset: 7,
    phase: "CORTO",
    title: "Vigencia de condiciones / cierre",
    messageText:
      "Hola {{contacto}}, te aviso que las condiciones y disponibilidad que te cotizamos siguen vigentes. Si prefieres dejarlo para más adelante, solo dime y te escribimos cuando lo necesites.",
  },
  {
    stepOrder: 5,
    dayOffset: 15,
    phase: "LARGO",
    title: "Nutrición · Novedad del mes",
    messageText:
      "Hola {{contacto}} de {{empresa}} 👋 Esta quincena nos ingresaron nuevos estilos y stock fresco en " +
      brandName +
      ". Si aún estás evaluando tu compra, con gusto te mando fotos actualizadas.",
  },
  {
    stepOrder: 6,
    dayOffset: 30,
    phase: "LARGO",
    title: "Nutrición · Contenido útil / reposición",
    messageText:
      "¡Hola {{contacto}}! Pasaba a saludar de parte de " +
      brandName +
      ". ¿Este mes necesitan cotizar uniformes, bordados, calzado o artículos deportivos para {{empresa}}?",
  },
  {
    stepOrder: 7,
    dayOffset: 60,
    phase: "LARGO",
    title: "Nutrición · Casos de clientes",
    messageText:
      "Hola {{contacto}}, seguimos equipando empresas, escuelas y equipos en todo Costa Rica. Cuando gustes retomar tu cotización con " +
      brandName +
      ", aquí estamos a la orden.",
  },
  {
    stepOrder: 8,
    dayOffset: 90,
    phase: "LARGO",
    title: "Nutrición · Reactivación trimestral",
    messageText:
      "¡Hola {{contacto}}! Han pasado 3 meses desde tu consulta en " +
      brandName +
      ". Si deseas que te preparemos una cotización actualizada o nueva reposición para {{empresa}}, solo respóndenos por aquí.",
  },
];

function renderVars(text: string, client: { contactName: string; company: string }) {
  const contacto = (client.contactName || client.company || "Cliente").trim();
  const empresa = (client.company || contacto).trim();
  return text
    .replace(/\{\{contacto\}\}/gi, contacto)
    .replace(/\{\{empresa\}\}/gi, empresa);
}

export async function GET() {
  const workspaceId = await getActiveWorkspaceId();
  const [sequences, clients] = await Promise.all([
    prisma.followUpSequence.findMany({
      where: { workspaceId },
      include: {
        steps: { orderBy: [{ dayOffset: "asc" }, { stepOrder: "asc" }] },
        enrollments: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { workspaceId, contactType: "CLIENTE" },
      select: { id: true, company: true, contactName: true, phone: true, whatsapp: true, stage: true, optOut: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const enriched = sequences.map((seq) => ({
    ...seq,
    enrollments: seq.enrollments.map((en) => ({
      ...en,
      client: clientMap.get(en.clientId) || null,
    })),
  }));

  return NextResponse.json({ sequences: enriched, clients });
}

export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const body = await req.json();
    const action = String(body.action || "create");

    // 1. One-click "Ciclo 1-7-90" preset
    if (action === "create_1_7_90") {
      const company = await getCompanySettings(workspaceId);
      const steps = PRESET_1_7_90_STEPS(company.brandName || "Nuestra Empresa");
      const seq = await prisma.followUpSequence.create({
        data: {
          workspaceId,
          name: "Ciclo 1-7-90 · Seguimiento de Proformas y Leads Fríos",
          description:
            "Secuencia inteligente de 9 pasos (Días 1, 3, 4, 5, 7 + Nutrición a 15, 30, 60 y 90 días). Se detiene automáticamente si el cliente responde, compra o pide no recibir mensajes.",
          trigger: "QUOTE_SENT",
          active: true,
          steps: { create: steps },
        },
        include: { steps: { orderBy: { dayOffset: "asc" } }, enrollments: true },
      });
      return NextResponse.json({
        ok: true,
        sequence: seq,
        message: "✅ Secuencia «Ciclo 1-7-90» creada con 9 pasos listos para usar.",
      });
    }

    // 2. Enroll one client OR all clients in a Kanban stage
    if (action === "enroll") {
      const sequenceId = String(body.sequenceId || "").trim();
      const clientId = String(body.clientId || "").trim();
      const stage = String(body.stage || "").trim();

      const seq = await prisma.followUpSequence.findFirst({
        where: { id: sequenceId, workspaceId },
        include: { steps: { orderBy: [{ dayOffset: "asc" }, { stepOrder: "asc" }] } },
      });
      if (!seq || seq.steps.length === 0) {
        return NextResponse.json({ error: "Secuencia no encontrada o sin pasos." }, { status: 404 });
      }

      const targets = clientId
        ? await prisma.client.findMany({ where: { id: clientId, workspaceId, optOut: false } })
        : await prisma.client.findMany({
            where: {
              workspaceId,
              optOut: false,
              ...(stage && stage !== "ALL" ? { stage } : { stage: { in: ["COTIZADO", "SEGUIMIENTO"] } }),
            },
          });

      const firstDayOffset = Math.max(0, seq.steps[0].dayOffset);
      const nextRunAt = new Date(Date.now() + firstDayOffset * 24 * 60 * 60 * 1000);
      let enrolledCount = 0;

      for (const c of targets) {
        const phone = normalizeCRPhone(c.whatsapp || c.phone);
        if (!phone) continue;
        await prisma.sequenceEnrollment.upsert({
          where: { sequenceId_clientId: { sequenceId: seq.id, clientId: c.id } },
          create: {
            workspaceId,
            sequenceId: seq.id,
            clientId: c.id,
            status: "ACTIVA",
            currentStepIndex: 0,
            nextRunAt,
          },
          update: {
            status: "ACTIVA",
            currentStepIndex: 0,
            nextRunAt,
          },
        });
        enrolledCount++;
      }

      return NextResponse.json({
        ok: true,
        enrolledCount,
        message:
          enrolledCount > 0
            ? `✅ ${enrolledCount} cliente(s) inscritos en "${seq.name}".`
            : "No se encontraron clientes elegibles con WhatsApp para inscribir.",
      });
    }

    // 3. Run all due sequence follow-ups now (respects opt-out, replies, GANADO/PERDIDO, and uses Meta templates outside 24h!)
    if (action === "run_due") {
      const cfg = await getIntegrationSettings(workspaceId);
      const company = await getCompanySettings(workspaceId);
      const now = new Date();

      const due = await prisma.sequenceEnrollment.findMany({
        where: {
          workspaceId,
          status: "ACTIVA",
          nextRunAt: { lte: now },
        },
        include: {
          sequence: {
            include: { steps: { orderBy: [{ dayOffset: "asc" }, { stepOrder: "asc" }] } },
          },
        },
      });

      let sent = 0;
      let stopped = 0;
      let skippedWindow = 0;

      for (const en of due) {
        if (!en.sequence.active) continue;
        const client = await prisma.client.findUnique({ where: { id: en.clientId } });
        if (!client || client.optOut || ["GANADO", "PERDIDO"].includes(client.stage)) {
          await prisma.sequenceEnrollment.update({
            where: { id: en.id },
            data: { status: "DETENIDA_RESPUESTA" },
          });
          stopped++;
          continue;
        }

        const step = en.sequence.steps[en.currentStepIndex];
        if (!step) {
          await prisma.sequenceEnrollment.update({
            where: { id: en.id },
            data: { status: "COMPLETADA" },
          });
          continue;
        }

        const toPhone = normalizeCRPhone(client.whatsapp || client.phone);
        if (!toPhone) continue;

        const text = renderVars(step.messageText, client);
        let sendOk = false;

        // If step has an approved Meta template assigned, send via official template (works after 24h!)
        if (step.templateName && cfg.metaAccessToken && cfg.metaPhoneNumberId) {
          const tplRes = await fetch(
            `https://graph.facebook.com/v21.0/${cfg.metaPhoneNumberId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${cfg.metaAccessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: toPhone,
                type: "template",
                template: {
                  name: step.templateName,
                  language: { code: step.templateLanguage || "es" },
                  components: [
                    {
                      type: "body",
                      parameters: [{ type: "text", text: client.contactName || client.company || "Cliente" }],
                    },
                  ],
                },
              }),
            }
          );
          sendOk = tplRes.ok;
        } else {
          // Otherwise check if inside 24h customer window before sending free-form WhatsApp text
          const convCheck = await prisma.conversation.findFirst({
            where: { workspaceId, channel: "WHATSAPP", externalId: toPhone },
            include: {
              messages: {
                where: { direction: "INBOUND" },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          });
          const lastInbound = convCheck?.messages?.[0]?.createdAt;
          const inside24h =
            lastInbound && Date.now() - lastInbound.getTime() < 24 * 60 * 60 * 1000;

          if (!inside24h) {
            skippedWindow++;
            continue;
          }

          const waRes = await sendWhatsAppCloudMessage({
            workspaceId,
            to: toPhone,
            text,
          });
          sendOk = waRes.ok;
        }

        if (sendOk) {
          sent++;
          let conv = await prisma.conversation.findFirst({
            where: { workspaceId, channel: "WHATSAPP", externalId: toPhone },
          });
          if (!conv) {
            conv = await prisma.conversation.create({
              data: {
                workspaceId,
                channel: "WHATSAPP",
                externalId: toPhone,
                subject: client.company || toPhone,
                clientId: client.id,
                lastMessageAt: now,
                lastMessagePreview: `🔁 ${text.slice(0, 125)}`,
              },
            });
          } else {
            await prisma.conversation.update({
              where: { id: conv.id },
              data: { lastMessageAt: now, lastMessagePreview: `🔁 ${text.slice(0, 125)}` },
            });
          }
          await prisma.message.create({
            data: {
              conversationId: conv.id,
              direction: "OUTBOUND",
              senderName: `${company.brandName} · Ciclo Día ${step.dayOffset}`,
              senderRole: "AI",
              body: `🔁 [Día ${step.dayOffset} · ${step.title}]\n${text}`,
              status: "SENT",
            },
          });

          const nextIdx = en.currentStepIndex + 1;
          const nextStep = en.sequence.steps[nextIdx];
          if (!nextStep) {
            await prisma.sequenceEnrollment.update({
              where: { id: en.id },
              data: { status: "COMPLETADA", currentStepIndex: nextIdx, lastSentAt: now },
            });
          } else {
            const deltaDays = Math.max(1, nextStep.dayOffset - step.dayOffset);
            await prisma.sequenceEnrollment.update({
              where: { id: en.id },
              data: {
                currentStepIndex: nextIdx,
                lastSentAt: now,
                nextRunAt: new Date(now.getTime() + deltaDays * 24 * 60 * 60 * 1000),
              },
            });
          }
        }
      }

      return NextResponse.json({
        ok: true,
        sent,
        stopped,
        skippedWindow,
        message: `Ejecución completada: ${sent} seguimiento(s) enviados, ${stopped} detenidos (cliente compró/opt-out)${
          skippedWindow > 0
            ? `, ${skippedWindow} omitidos por ventana 24h cerrada (asigna una Plantilla Meta a esos pasos)`
            : ""
        }.`,
      });
    }

    return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
  } catch (err) {
    console.error("Sequence POST error:", err);
    return NextResponse.json({ error: "Error procesando secuencia." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const body = await req.json();

  if (body.stepId) {
    const step = await prisma.sequenceStep.update({
      where: { id: String(body.stepId) },
      data: {
        ...(body.title !== undefined ? { title: String(body.title) } : {}),
        ...(body.dayOffset !== undefined ? { dayOffset: Number(body.dayOffset) || 1 } : {}),
        ...(body.messageText !== undefined ? { messageText: String(body.messageText) } : {}),
        ...(body.templateName !== undefined ? { templateName: String(body.templateName) } : {}),
        ...(body.templateLanguage !== undefined ? { templateLanguage: String(body.templateLanguage) } : {}),
      },
    });
    return NextResponse.json({ ok: true, step });
  }

  if (body.enrollmentId) {
    const en = await prisma.sequenceEnrollment.updateMany({
      where: { id: String(body.enrollmentId), workspaceId },
      data: {
        ...(body.status !== undefined ? { status: String(body.status) } : {}),
      },
    });
    return NextResponse.json({ ok: true, updated: en.count });
  }

  if (body.id) {
    const seq = await prisma.followUpSequence.updateMany({
      where: { id: String(body.id), workspaceId },
      data: {
        ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
        ...(body.name !== undefined ? { name: String(body.name) } : {}),
      },
    });
    return NextResponse.json({ ok: true, updated: seq.count });
  }

  return NextResponse.json({ error: "Falta identificador" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  await prisma.followUpSequence.deleteMany({ where: { id, workspaceId } });
  return NextResponse.json({ ok: true });
}
