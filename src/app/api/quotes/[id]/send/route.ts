import { NextRequest, NextResponse } from "next/server";
import { getCompanySettings, getIntegrationSettings, prisma } from "@/lib/prisma";
import { generateProformaPdf } from "@/lib/pdf";
import { formatMoney, normalizeCRPhone, sanitizeFilename } from "@/lib/format";
import { sendCorporateEmail } from "@/lib/email";
import { buildWhatsAppDesktopLinks, sendWhatsAppCloudMessage } from "@/lib/meta";
import { runTriggerAutomations } from "@/lib/automations";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { signQuotePdfToken } from "@/lib/security";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const { id } = await context.params;
    const body = await req.json();
    const channel: "EMAIL" | "WHATSAPP" | "BOTH" = body.channel || "EMAIL";

    const quote = await prisma.quote.findFirst({
      where: { id, workspaceId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!quote) {
      return NextResponse.json({ error: "Proforma no encontrada." }, { status: 404 });
    }

    const company = await getCompanySettings(workspaceId);
    const integrations = await getIntegrationSettings(workspaceId);
    const filename = `${quote.number}-${sanitizeFilename(quote.clientCompany)}.pdf`;
    const pdfBytes = await generateProformaPdf(quote);
    const signedPdfPath = `/api/quotes/${quote.id}/pdf?sig=${signQuotePdfToken(quote.id)}`;

    const defaultMessage =
      body.message ||
      `Estimado(a) ${quote.clientContact || quote.clientCompany},\n\nAdjunto Factura Proforma #${quote.number} solicitada para su revisión (${quote.jobTitle || "Cotización"}) por un total de ${formatMoney(quote.total, quote.currency)}.\n\nQuedamos atentos a cualquier consulta.\nSaludos,\n${quote.seller || company.defaultSeller}\n${company.brandName} | Tel: ${company.phone} | WhatsApp: ${company.whatsapp}`;

    const results: Record<string, unknown> = { filename };
    const sentChannels: string[] = quote.sentVia ? quote.sentVia.split(",").filter(Boolean) : [];

    // 1. Send via Corporate SMTP Email with attached PDF
    if (channel === "EMAIL" || channel === "BOTH") {
      const targetEmail = String(body.toEmail || quote.clientEmail || "").trim();
      if (!targetEmail) {
        return NextResponse.json({ error: "El cliente no tiene correo electrónico configurado." }, { status: 400 });
      }
      const subject =
        body.subject || `Factura Proforma #${quote.number} - ${quote.clientCompany} | ${company.brandName}`;

      const emailRes = await sendCorporateEmail({
        to: targetEmail,
        subject,
        text: defaultMessage,
        fromAccountId: body.fromAccountId ? String(body.fromAccountId) : undefined,
        workspaceId,
        attachments: [
          {
            filename,
            content: Buffer.from(pdfBytes),
            contentType: "application/pdf",
          },
        ],
      });
      results.email = emailRes;
      if (!sentChannels.includes("CORREO")) sentChannels.push("CORREO");

      let conv = await prisma.conversation.findFirst({
        where: { workspaceId, channel: "EMAIL", externalId: targetEmail },
      });
      if (!conv) {
        conv = await prisma.conversation.create({
          data: {
            workspaceId,
            channel: "EMAIL",
            externalId: targetEmail,
            subject,
            clientId: quote.clientId,
            lastMessagePreview: `Proforma #${quote.number} enviada (${filename})`,
          },
        });
      }
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          direction: "OUTBOUND",
          senderName: quote.seller || company.defaultSeller,
          senderRole: "AGENT",
          subject,
          body: defaultMessage,
          externalMessageId: emailRes.messageId || "",
          attachmentName: filename,
          attachmentUrl: signedPdfPath,
          status: emailRes.simulated ? "SIMULATED" : "SENT",
        },
      });
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: new Date(), lastMessagePreview: `Proforma #${quote.number} (${filename})` },
      });
    }

    // 2. Send via WhatsApp (Meta Cloud API + desktop fallback links)
    if (channel === "WHATSAPP" || channel === "BOTH") {
      const targetPhone = normalizeCRPhone(body.toPhone || quote.clientPhone || "");
      if (!targetPhone) {
        return NextResponse.json({ error: "El cliente no tiene teléfono/WhatsApp configurado." }, { status: 400 });
      }

      const publicBase = integrations.metaPublicWebhookUrl
        ? integrations.metaPublicWebhookUrl.replace(/\/api\/webhooks\/meta.*$/, "")
        : "";
      const documentUrl = publicBase ? `${publicBase}${signedPdfPath}` : undefined;

      const waRes = await sendWhatsAppCloudMessage({
        workspaceId,
        to: targetPhone,
        text: defaultMessage,
        documentUrl,
        documentFilename: filename,
      });
      const desktopLinks = buildWhatsAppDesktopLinks(targetPhone, defaultMessage);
      results.whatsapp = { ...waRes, ...desktopLinks };
      if (!sentChannels.includes("WHATSAPP")) sentChannels.push("WHATSAPP");

      let conv = await prisma.conversation.findFirst({
        where: { workspaceId, channel: "WHATSAPP", externalId: targetPhone },
      });
      if (!conv) {
        conv = await prisma.conversation.create({
          data: {
            workspaceId,
            channel: "WHATSAPP",
            externalId: targetPhone,
            subject: quote.clientCompany,
            clientId: quote.clientId,
            lastMessagePreview: `Proforma #${quote.number} enviada por WhatsApp`,
          },
        });
      }
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          direction: "OUTBOUND",
          senderName: quote.seller || company.defaultSeller,
          senderRole: "AGENT",
          body: defaultMessage,
          externalMessageId: waRes.externalMessageId || "",
          attachmentName: filename,
          attachmentUrl: signedPdfPath,
          status: waRes.simulated ? "SIMULATED" : waRes.ok ? "SENT" : "FAILED",
        },
      });
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: new Date(), lastMessagePreview: `Proforma #${quote.number} (${filename})` },
      });
    }

    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: "ENVIADA",
        sentAt: new Date(),
        sentVia: sentChannels.join(","),
      },
    });

    if (quote.clientId) {
      await prisma.activity.create({
        data: {
          workspaceId,
          clientId: quote.clientId,
          quoteId: quote.id,
          type: channel === "WHATSAPP" ? "WHATSAPP" : "CORREO",
          title: `Proforma #${quote.number} enviada vía ${channel}`,
          description: `Archivo: ${filename} — Total: ${formatMoney(quote.total, quote.currency)}`,
          completed: true,
        },
      });
      await runTriggerAutomations("QUOTE_SENT", {
        workspaceId,
        clientId: quote.clientId,
        quoteId: quote.id,
        channel,
      });
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("Send quote error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error enviando la proforma." },
      { status: 500 }
    );
  }
}
