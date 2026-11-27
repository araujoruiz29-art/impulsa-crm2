import { NextRequest, NextResponse } from "next/server";
import { getCompanySettings, prisma } from "@/lib/prisma";
import {
  sendMetaSocialMessage,
  sendWhatsAppAudioNote,
  sendWhatsAppCloudMessage,
  sendWhatsAppInteractiveButtons,
} from "@/lib/meta";
import { sendCorporateEmail } from "@/lib/email";
import { syncCrmFromConversation } from "@/lib/crm-autopilot";
import { getActiveWorkspaceId, getCurrentSession } from "@/lib/workspace";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const workspaceId = await getActiveWorkspaceId();
  const { id } = await context.params;
  const body = await req.json();

  const existing = await prisma.conversation.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Conversación no encontrada." }, { status: 404 });
  }

  const conv = await prisma.conversation.update({
    where: { id },
    data: {
      ...(body.aiEnabled !== undefined ? { aiEnabled: Boolean(body.aiEnabled) } : {}),
      ...(body.unreadCount !== undefined ? { unreadCount: Number(body.unreadCount) } : {}),
      ...(body.status !== undefined ? { status: String(body.status) } : {}),
      ...(body.assignedUserId !== undefined ? { assignedUserId: String(body.assignedUserId) } : {}),
      ...(body.assignedAgentName !== undefined ? { assignedAgentName: String(body.assignedAgentName) } : {}),
    },
  });
  return NextResponse.json({ conversation: conv });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const { id } = await context.params;
    const body = await req.json();
    const text = String(body.body || "").trim();
    if (!text) {
      return NextResponse.json({ error: "El mensaje no puede estar vacío." }, { status: 400 });
    }

    const conv = await prisma.conversation.findFirst({
      where: { id, workspaceId },
      include: { client: true },
    });
    if (!conv) {
      return NextResponse.json({ error: "Conversación no encontrada." }, { status: 404 });
    }

    const company = await getCompanySettings(conv.workspaceId);

    // Private Internal Team Note (never sent to external customer channel!)
    if (body.isInternalNote === true) {
      const session = await getCurrentSession();
      const noteMsg = await prisma.message.create({
        data: {
          conversationId: conv.id,
          direction: "INTERNAL",
          senderName: session?.email ? `${company.defaultSeller} (${session.email})` : company.defaultSeller,
          senderRole: "INTERNAL_NOTE",
          subject: "",
          body: text,
          externalMessageId: "",
          status: "INTERNAL",
        },
      });
      return NextResponse.json(
        { message: noteMsg, deliveryInfo: "🔒 Nota interna guardada (el cliente NO la ve)." },
        { status: 201 }
      );
    }

    let status = "SENT";
    let externalMessageId = "";
    let deliveryInfo = "";

    if (conv.channel === "WHATSAPP") {
      if (Array.isArray(body.interactiveButtons) && body.interactiveButtons.length > 0) {
        const waBtn = await sendWhatsAppInteractiveButtons({
          workspaceId: conv.workspaceId,
          to: conv.externalId,
          bodyText: text,
          buttons: body.interactiveButtons,
          footerText: company.brandName,
        });
        status = waBtn.simulated ? "SIMULATED" : waBtn.ok ? "SENT" : "FAILED";
        externalMessageId = waBtn.externalMessageId || "";
        deliveryInfo = waBtn.info || waBtn.error || "";
      } else if (body.sendAsVoiceNote === true) {
        const waAudio = await sendWhatsAppAudioNote({
          workspaceId: conv.workspaceId,
          to: conv.externalId,
          text,
        });
        if (waAudio.ok) {
          status = "SENT";
          externalMessageId = waAudio.externalMessageId || "";
          deliveryInfo = waAudio.info || "";
        } else {
          const waFallback = await sendWhatsAppCloudMessage({
            workspaceId: conv.workspaceId,
            to: conv.externalId,
            text,
          });
          status = waFallback.simulated ? "SIMULATED" : waFallback.ok ? "SENT" : "FAILED";
          externalMessageId = waFallback.externalMessageId || "";
          deliveryInfo = `${waAudio.error || "Audio no disponible"} · Enviado como texto.`;
        }
      } else {
        const wa = await sendWhatsAppCloudMessage({
          workspaceId: conv.workspaceId,
          to: conv.externalId,
          text,
        });
        status = wa.simulated ? "SIMULATED" : wa.ok ? "SENT" : "FAILED";
        externalMessageId = wa.externalMessageId || "";
        deliveryInfo = wa.info || wa.error || "";
      }
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
        subject: body.subject || `Re: ${conv.subject || `Consulta ${company.brandName}`}`,
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
        senderName: body.senderRole === "AI" ? `Agente IA ${company.brandName}` : company.defaultSeller,
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
        ...(!conv.firstAgentReplyAt ? { firstAgentReplyAt: new Date() } : {}),
      },
    });

    const autopilot = await syncCrmFromConversation(conv.id, conv.workspaceId).catch(() => null);

    return NextResponse.json({ message: msg, deliveryInfo, autopilot }, { status: 201 });
  } catch (err) {
    console.error("Send message error:", err);
    return NextResponse.json({ error: "Error enviando mensaje." }, { status: 500 });
  }
}
