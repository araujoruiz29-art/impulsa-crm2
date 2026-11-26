import { prisma } from "./prisma";
import { normalizeCRPhone } from "./format";

function phoneVariants(raw: string): string[] {
  const norm = normalizeCRPhone(raw);
  if (!norm) return [];
  const set = new Set<string>([norm]);
  if (norm.startsWith("506") && norm.length === 11) {
    set.add(norm.slice(3));
    set.add(`+${norm}`);
  }
  return Array.from(set);
}

/**
 * Automatically merges any duplicate WhatsApp conversations and duplicate WhatsApp clients
 * (e.g. caused by Meta sending two parallel webhook events milliseconds apart).
 */
export async function mergeDuplicateWhatsAppThreads(workspaceId: string): Promise<number> {
  const waConvs = await prisma.conversation.findMany({
    where: { workspaceId, channel: "WHATSAPP" },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      client: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by canonical normalized CR phone
  const groups = new Map<string, typeof waConvs>();
  for (const c of waConvs) {
    const key = normalizeCRPhone(c.externalId) || c.externalId.trim();
    if (!key) continue;
    const arr = groups.get(key) || [];
    arr.push(c);
    groups.set(key, arr);
  }

  let mergedCount = 0;

  for (const [normPhone, list] of groups.entries()) {
    if (list.length <= 1) continue;

    // Pick canonical conversation: prefer one whose client/subject has a real name (not just digits), oldest first
    const primary =
      list.find((c) => c.subject && !/^\+?\d+$/.test(c.subject.replace(/\s+/g, ""))) ||
      list[0];
    const duplicates = list.filter((c) => c.id !== primary.id);

    const dupIds = duplicates.map((d) => d.id);
    const allMsgs = list
      .flatMap((c) => c.messages)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const newestMsg = allMsgs[allMsgs.length - 1];
    const totalUnread = list.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

    // Move all messages from duplicate conversations to primary
    await prisma.message.updateMany({
      where: { conversationId: { in: dupIds } },
      data: { conversationId: primary.id },
    });

    // Move any seller alerts referencing duplicate conversations to primary
    await prisma.sellerAlert.updateMany({
      where: { workspaceId, conversationId: { in: dupIds } },
      data: { conversationId: primary.id },
    });

    // Pick best human-readable subject
    const bestSubject =
      list.find((c) => c.subject && !/^\+?\d+$/.test(c.subject.replace(/\s+/g, "")))?.subject ||
      primary.subject ||
      normPhone;

    // Update primary conversation metadata
    await prisma.conversation.update({
      where: { id: primary.id },
      data: {
        externalId: normPhone,
        subject: bestSubject,
        unreadCount: totalUnread,
        aiEnabled: list.every((c) => c.aiEnabled),
        lastMessageAt: newestMsg ? newestMsg.createdAt : primary.lastMessageAt,
        lastMessagePreview: newestMsg
          ? newestMsg.body.slice(0, 140)
          : primary.lastMessagePreview,
      },
    });

    // Delete now-empty duplicate conversation shells
    await prisma.conversation.deleteMany({
      where: { id: { in: dupIds } },
    });

    // Also merge duplicate Client records tied to those duplicate conversations
    const clientIds = Array.from(
      new Set(list.map((c) => c.clientId).filter((id): id is string => Boolean(id)))
    );
    if (clientIds.length > 1) {
      const primaryClientId = primary.clientId || clientIds[0];
      const dupClientIds = clientIds.filter((id) => id !== primaryClientId);
      await Promise.all([
        prisma.conversation.updateMany({
          where: { workspaceId, clientId: { in: dupClientIds } },
          data: { clientId: primaryClientId },
        }),
        prisma.quote.updateMany({
          where: { workspaceId, clientId: { in: dupClientIds } },
          data: { clientId: primaryClientId },
        }),
        prisma.activity.updateMany({
          where: { workspaceId, clientId: { in: dupClientIds } },
          data: { clientId: primaryClientId },
        }),
        prisma.sellerAlert.updateMany({
          where: { workspaceId, clientId: { in: dupClientIds } },
          data: { clientId: primaryClientId },
        }),
      ]);
      await prisma.client.deleteMany({
        where: { workspaceId, id: { in: dupClientIds } },
      });
    }

    mergedCount += duplicates.length;
  }

  return mergedCount;
}

/**
 * Race-safe lookup/creation for inbound WhatsApp clients & conversations.
 */
export async function findOrCreateWhatsAppClient(
  workspaceId: string,
  from: string,
  profileName: string
) {
  const variants = phoneVariants(from);
  const norm = normalizeCRPhone(from) || from;

  let client = await prisma.client.findFirst({
    where: {
      workspaceId,
      OR: [
        { whatsapp: { in: variants } },
        { phone: { in: variants } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  if (!client) {
    client = await prisma.client.create({
      data: {
        workspaceId,
        company: profileName,
        contactName: profileName,
        phone: norm,
        whatsapp: norm,
        stage: "NUEVO",
        source: "WHATSAPP",
        notes: "Capturado automáticamente desde WhatsApp Cloud API.",
      },
    });
  } else if (
    profileName &&
    !/^\+?\d+$/.test(profileName.replace(/\s+/g, "")) &&
    /^\+?\d+$/.test((client.company || "").replace(/\s+/g, ""))
  ) {
    client = await prisma.client.update({
      where: { id: client.id },
      data: { company: profileName, contactName: profileName },
    });
  }

  return client;
}

export async function findOrCreateWhatsAppConversation(
  workspaceId: string,
  from: string,
  profileName: string,
  clientId: string,
  previewText: string
) {
  const variants = phoneVariants(from);
  const norm = normalizeCRPhone(from) || from;

  const existing = await prisma.conversation.findMany({
    where: {
      workspaceId,
      channel: "WHATSAPP",
      externalId: { in: variants },
    },
    orderBy: { createdAt: "asc" },
  });

  let conv = existing[0];

  if (!conv) {
    conv = await prisma.conversation.create({
      data: {
        workspaceId,
        channel: "WHATSAPP",
        externalId: norm,
        subject: profileName,
        clientId,
        unreadCount: 1,
        lastMessageAt: new Date(),
        lastMessagePreview: previewText.slice(0, 140),
      },
    });
    // If a parallel Meta webhook raced us and created a second conversation, merge immediately!
    const afterCount = await prisma.conversation.count({
      where: { workspaceId, channel: "WHATSAPP", externalId: { in: variants } },
    });
    if (afterCount > 1) {
      await mergeDuplicateWhatsAppThreads(workspaceId);
      const canonical = await prisma.conversation.findFirst({
        where: { workspaceId, channel: "WHATSAPP", externalId: { in: variants } },
        orderBy: { createdAt: "asc" },
      });
      if (canonical) conv = canonical;
    }
  } else {
    conv = await prisma.conversation.update({
      where: { id: conv.id },
      data: {
        externalId: norm,
        ...(profileName &&
        !/^\+?\d+$/.test(profileName.replace(/\s+/g, "")) &&
        /^\+?\d+$/.test((conv.subject || "").replace(/\s+/g, ""))
          ? { subject: profileName }
          : {}),
        unreadCount: { increment: 1 },
        lastMessageAt: new Date(),
        lastMessagePreview: previewText.slice(0, 140),
      },
    });
  }

  return conv;
}
