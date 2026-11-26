import { NextRequest, NextResponse } from "next/server";
import { getCompanySettings, prisma } from "@/lib/prisma";
import { sendMetaSocialMessage, sendWhatsAppCloudMessage } from "@/lib/meta";
import { sendCorporateEmail } from "@/lib/email";
import { syncCrmFromConversation } from "@/lib/crm-autopilot";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json();
  const conv = await prisma.conversation.update({
    where: { id },
    data: {
      ...(body.aiEnabled !== undefined ? { aiEnabled: Boolean(body.aiEnabled) } : {}),
      ...(body.unreadCount !== undefined ? { unreadCount: Number(body.unreadCount) } : {}),
      ...(body.status !== undefined ? { status: String(body.status) } : {}),
    },
  });
  return NextResponse.json({ conversation: conv });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const text = String(body.body || "").trim();
    if (!text) {
      return NextResponse.json({ error: "El mensaje no puede estar vacío." }, { status: 400 });
    }

    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!conv) {
      return NextResponse.json({ error: "Conversación no encontrada." }, { status: 404 });
    }

    const company = await getCompanySettings(conv.workspaceId);
    let status = "SENT";
    let externalMessageId = "";
    let deliveryInfo = "";

    if (conv.channel === "WHATSAPP") {
      const wa = await sendWhatsAppCloudMessage({
        workspaceId: conv.workspaceId,
        to: conv.externalId,
        text,
      });
      status = wa.simulated ? "SIMULATED" : wa.ok ? "SENT" : "FAILED";
      externalMessageId = wa.externalMessageId || "";
      deliveryInfo = wa.info || wa.error || "";
    } else if (conv.channel === "FACEBOOK" || conv.channel === "INSTAGRAM") {
      const social = await sendMetaSocialMessage({
        workspaceId: conv.workspaceId,
        channel: conv.channel,
        recipientId: conv.externalId,
        text,
      });
      status = social.simulated ? "SIMULATED" : social.ok ? "SENT" : "FAILED";
      externalMessageId = social.externalMessageId || "";
      deliveryInfo = social.info || social.error || "";
    } else if (conv.channel === "EMAIL") {
      const mail = await sendCorporateEmail({
        to: conv.externalId,
        subject: body.subject || `Re: ${conv.subject || "Consulta Caminante Corporativo"}`,
        text,
        fromEmail: conv.accountEmail || undefined,
        workspaceId: conv.workspaceId,
      });
      status = mail.simulated ? "SIMULATED" : "SENT";
      externalMessageId = mail.messageId || "";
      deliveryInfo = mail.info || "";
    }

    const msg = await prisma.message.create({
      data: {
        conversationId: conv.id,
        direction: "OUTBOUND",
        senderName: body.senderRole === "AI" ? "Agente IA Caminante" : company.defaultSeller,
        senderRole: body.senderRole || "AGENT",
        subject: body.subject || "",
        body: text,
        externalMessageId,
        status,
      },
    });

    await prisma.conversation.update({
      where: { id: conv.id },
      data: {
        unreadCount: 0,
        lastMessageAt: new Date(),
        lastMessagePreview: text.slice(0, 140),
      },
    });

    // Silent CRM Autopilot: reads manual seller reply and updates Kanban/tags/Agenda automatically
    const autopilot = await syncCrmFromConversation(conv.id, conv.workspaceId).catch(() => null);

    return NextResponse.json({ message: msg, deliveryInfo, autopilot }, { status: 201 });
  } catch (err) {
    console.error("Send message error:", err);
    return NextResponse.json({ error: "Error enviando mensaje." }, { status: 500 });
  }
}
