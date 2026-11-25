import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeCRPhone } from "@/lib/format";
import { runTriggerAutomations } from "@/lib/automations";
import { qualifyLeadAndNotifySeller } from "@/lib/ai-agent";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const { searchParams } = new URL(req.url);
  const channel = (searchParams.get("channel") || "").trim();

  const conversations = await prisma.conversation.findMany({
    where: {
      workspaceId,
      ...(channel && channel !== "ALL" ? { channel } : {}),
    },
    include: {
      client: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  return NextResponse.json({ conversations });
}

// Create new conversation OR simulate incoming WhatsApp / Meta Lead / Email message for local testing
export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const body = await req.json();
    const channel = String(body.channel || "WHATSAPP").toUpperCase();
    const senderName = String(body.senderName || "Prospecto Nuevo").trim();
    const company = String(body.company || senderName).trim();
    const contact =
      channel === "EMAIL"
        ? String(body.contact || "cliente@empresa.cr").trim()
        : normalizeCRPhone(body.contact || "8800-0000");
    const messageBody = String(body.body || "").trim();

    if (!messageBody) {
      return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });
    }

    // Find or create client
    let client = await prisma.client.findFirst({
      where:
        channel === "EMAIL"
          ? { workspaceId, email: contact }
          : { workspaceId, OR: [{ whatsapp: contact }, { phone: body.contact || "" }] },
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          workspaceId,
          company,
          contactName: senderName,
          phone: channel === "EMAIL" ? "" : String(body.contact || contact),
          whatsapp: channel === "EMAIL" ? "" : contact,
          email: channel === "EMAIL" ? contact : String(body.email || ""),
          stage: "NUEVO",
          source: channel === "META_LEAD" ? "META_ADS" : channel,
          metaCampaign: String(body.campaign || ""),
          notes: `Creado automáticamente desde ${channel}.`,
        },
      });
    }

    let conv = await prisma.conversation.findFirst({
      where: { workspaceId, channel: channel === "META_LEAD" ? "WHATSAPP" : channel, externalId: contact },
    });

    if (!conv) {
      conv = await prisma.conversation.create({
        data: {
          workspaceId,
          channel: channel === "META_LEAD" ? "WHATSAPP" : channel,
          externalId: contact,
          subject: String(body.subject || company),
          clientId: client.id,
          aiEnabled: body.aiEnabled !== false,
          unreadCount: 1,
          lastMessageAt: new Date(),
          lastMessagePreview: messageBody.slice(0, 140),
        },
      });
    } else {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date(),
          lastMessagePreview: messageBody.slice(0, 140),
        },
      });
    }

    await prisma.message.create({
      data: {
        conversationId: conv.id,
        direction: "INBOUND",
        senderName,
        senderRole: "CLIENT",
        subject: String(body.subject || ""),
        body: messageBody,
        status: "DELIVERED",
      },
    });

    // Qualify lead & notify seller automatically if ready to buy
    const qualification = await qualifyLeadAndNotifySeller({
      clientId: client.id,
      conversationId: conv.id,
      messageBody,
      isAudio: Boolean(body.isAudio),
    });

    // Fire matching automation rules (e.g., Meta Lead welcome or AI auto-reply)
    const trigger =
      channel === "META_LEAD"
        ? "NEW_META_LEAD"
        : channel === "EMAIL"
        ? "NEW_EMAIL"
        : "NEW_WHATSAPP_MESSAGE";

    const automations = await runTriggerAutomations(trigger, {
      clientId: client.id,
      conversationId: conv.id,
      messageBody,
      channel,
    });

    const refreshed = await prisma.conversation.findUnique({
      where: { id: conv.id },
      include: { client: true, messages: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json({ conversation: refreshed, automations, qualification }, { status: 201 });
  } catch (err) {
    console.error("Create/simulate conversation error:", err);
    return NextResponse.json({ error: "Error procesando mensaje entrante." }, { status: 500 });
  }
}
