import { NextRequest, NextResponse } from "next/server";
import { getCompanySettings, getIntegrationSettings, prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { normalizeCRPhone } from "@/lib/format";

function fillVars(
  templateVars: string[],
  client: { contactName: string; company: string }
): string[] {
  const contacto = (client.contactName || client.company || "Cliente").trim();
  const empresa = (client.company || contacto).trim();
  return templateVars.map((v) =>
    String(v || "")
      .replace(/\{\{contacto\}\}/gi, contacto)
      .replace(/\{\{empresa\}\}/gi, empresa)
      .trim() || contacto
  );
}

function renderBodyPreview(bodyText: string, resolvedVars: string[]): string {
  if (!bodyText) return "";
  return bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => {
    const idx = Number(n) - 1;
    return resolvedVars[idx] || `{{${n}}}`;
  });
}

// GET: List past campaigns + live audience preview counts
export async function GET(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const { searchParams } = new URL(req.url);
  const stage = (searchParams.get("stage") || "ALL").trim();
  const tag = (searchParams.get("tag") || "").trim().toLowerCase();

  const [campaigns, allClients, company, cfg] = await Promise.all([
    prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.client.findMany({
      where: { workspaceId, contactType: "CLIENTE" },
      select: {
        id: true,
        company: true,
        contactName: true,
        phone: true,
        whatsapp: true,
        stage: true,
        tags: true,
        optOut: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    getCompanySettings(workspaceId),
    getIntegrationSettings(workspaceId),
  ]);

  const filtered = allClients.filter((c) => {
    const phone = normalizeCRPhone(c.whatsapp || c.phone);
    if (!phone) return false;
    if (stage && stage !== "ALL" && c.stage !== stage) return false;
    if (tag && !(c.tags || "").toLowerCase().includes(tag)) return false;
    return true;
  });

  const eligible = filtered.filter((c) => !c.optOut);
  const skippedOptOut = filtered.length - eligible.length;

  return NextResponse.json({
    campaigns,
    audience: {
      eligibleCount: eligible.length,
      skippedOptOut,
      sample: eligible.slice(0, 6).map((c) => ({
        id: c.id,
        company: c.company,
        contactName: c.contactName,
        phone: normalizeCRPhone(c.whatsapp || c.phone),
        stage: c.stage,
      })),
    },
    senderInfo: {
      brandName: company.brandName,
      whatsapp: company.whatsapp,
      metaReady: Boolean(cfg.metaAccessToken && cfg.metaPhoneNumberId),
    },
  });
}

// POST: Launch a safe bulk WhatsApp campaign via Official Meta Cloud API Templates
export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const [cfg, company] = await Promise.all([
      getIntegrationSettings(workspaceId),
      getCompanySettings(workspaceId),
    ]);

    if (!cfg.metaAccessToken || !cfg.metaPhoneNumberId) {
      return NextResponse.json(
        { error: "Conecta primero tu WhatsApp Business (API Oficial) en Conexiones y empresa." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const name = String(body.name || "").trim() || `Campaña ${new Date().toLocaleDateString("es-CR")}`;
    const templateName = String(body.templateName || "").trim();
    const templateLanguage = String(body.templateLanguage || "es").trim();
    const templateBodyText = String(body.templateBodyText || "").trim();
    const variables: string[] = Array.isArray(body.variables)
      ? body.variables.map((v: unknown) => String(v ?? ""))
      : [];
    const targetStage = String(body.targetStage || "ALL").trim();
    const targetTag = String(body.targetTag || "").trim();
    const maxBatch = Math.min(200, Math.max(1, Number(body.maxBatch) || 100));

    if (!templateName) {
      return NextResponse.json(
        { error: "Selecciona una plantilla aprobada de Meta para enviar la campaña." },
        { status: 400 }
      );
    }

    const allClients = await prisma.client.findMany({
      where: { workspaceId, contactType: "CLIENTE" },
      orderBy: { updatedAt: "desc" },
    });

    const matched = allClients.filter((c) => {
      const phone = normalizeCRPhone(c.whatsapp || c.phone);
      if (!phone) return false;
      if (targetStage && targetStage !== "ALL" && c.stage !== targetStage) return false;
      if (targetTag && !(c.tags || "").toLowerCase().includes(targetTag.toLowerCase())) return false;
      return true;
    });

    const skippedOptOut = matched.filter((c) => c.optOut).length;
    const recipients = matched.filter((c) => !c.optOut).slice(0, maxBatch);

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No hay contactos elegibles con teléfono de WhatsApp para ese filtro." },
        { status: 400 }
      );
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const client of recipients) {
      const toPhone = normalizeCRPhone(client.whatsapp || client.phone);
      const resolvedVars = fillVars(variables, client);
      const preview = renderBodyPreview(templateBodyText, resolvedVars) || `Plantilla ${templateName}`;

      const components =
        resolvedVars.length > 0
          ? [
              {
                type: "body",
                parameters: resolvedVars.map((text) => ({ type: "text", text })),
              },
            ]
          : undefined;

      try {
        const res = await fetch(
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
                name: templateName,
                language: { code: templateLanguage },
                ...(components ? { components } : {}),
              },
            }),
          }
        );

        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          sentCount++;
          const externalMessageId = data?.messages?.[0]?.id || `camp-${Date.now()}`;

          // Log into client's WhatsApp conversation so sellers see the full campaign context
          let conv = await prisma.conversation.findFirst({
            where: { workspaceId, channel: "WHATSAPP", externalId: toPhone },
            orderBy: { createdAt: "asc" },
          });
          if (!conv) {
            conv = await prisma.conversation.create({
              data: {
                workspaceId,
                channel: "WHATSAPP",
                externalId: toPhone,
                subject: client.company || client.contactName || toPhone,
                clientId: client.id,
                unreadCount: 0,
                lastMessageAt: new Date(),
                lastMessagePreview: `📣 ${preview.slice(0, 125)}`,
              },
            });
          } else {
            await prisma.conversation.update({
              where: { id: conv.id },
              data: {
                lastMessageAt: new Date(),
                lastMessagePreview: `📣 ${preview.slice(0, 125)}`,
              },
            });
          }

          await prisma.message.create({
            data: {
              conversationId: conv.id,
              direction: "OUTBOUND",
              senderName: `${company.brandName} · Campaña`,
              senderRole: "AGENT",
              body: `📣 [Campaña: ${name}]\n${preview}`,
              externalMessageId,
              status: "SENT",
            },
          });
        } else {
          failedCount++;
          if (errors.length < 5) {
            errors.push(`${client.company}: ${data?.error?.message || `HTTP ${res.status}`}`);
          }
        }
      } catch (e) {
        failedCount++;
        if (errors.length < 5) {
          errors.push(`${client.company}: ${e instanceof Error ? e.message : "Error de red"}`);
        }
      }

      // Gentle throttle (120ms) to stay well within Meta Cloud API rate limits
      await new Promise((r) => setTimeout(r, 120));
    }

    const campaign = await prisma.campaign.create({
      data: {
        workspaceId,
        name,
        templateName,
        templateLanguage,
        templatePreview: templateBodyText,
        variablesJson: JSON.stringify(variables),
        targetStage,
        targetTag,
        status: "COMPLETADA",
        totalCount: recipients.length,
        sentCount,
        failedCount,
        skippedOptOut,
        completedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        campaign,
        errors,
        message: `Campaña "${name}" completada: ${sentCount} enviado(s), ${failedCount} fallido(s), ${skippedOptOut} protegido(s) por opt-out.`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Campaign send error:", err);
    return NextResponse.json({ error: "Error ejecutando la campaña." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  await prisma.campaign.deleteMany({ where: { id, workspaceId } });
  return NextResponse.json({ ok: true });
}
