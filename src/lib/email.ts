import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getIntegrationSettings, prisma } from "./prisma";
import { getActiveWorkspaceId } from "./workspace";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromAccountId?: string;
  fromEmail?: string;
  workspaceId?: string;
  attachments?: {
    filename: string;
    content: Buffer;
    contentType?: string;
  }[];
}

async function resolveMailAccount(opts: {
  workspaceId: string;
  accountId?: string;
  email?: string;
}) {
  if (opts.accountId) {
    const found = await prisma.emailAccount.findUnique({ where: { id: opts.accountId } });
    if (found) return found;
  }
  if (opts.email) {
    const found = await prisma.emailAccount.findFirst({
      where: { workspaceId: opts.workspaceId, email: opts.email },
    });
    if (found) return found;
  }
  // Prefer default configured account with password
  const accounts = await prisma.emailAccount.findMany({
    where: { workspaceId: opts.workspaceId, active: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  const configured = accounts.find((a) => a.smtpHost && a.smtpUser && a.smtpPass);
  if (configured) return configured;

  // Fallback to legacy IntegrationSettings
  const legacy = await getIntegrationSettings(opts.workspaceId);
  if (legacy.smtpHost && legacy.smtpUser && legacy.smtpPass) {
    return {
      id: "legacy",
      workspaceId: opts.workspaceId,
      label: "Principal",
      email: legacy.smtpFromEmail || legacy.smtpUser,
      fromName: legacy.smtpFromName || "Caminante Corporativo",
      smtpHost: legacy.smtpHost,
      smtpPort: legacy.smtpPort,
      smtpSecure: legacy.smtpSecure,
      smtpUser: legacy.smtpUser,
      smtpPass: legacy.smtpPass,
      imapHost: legacy.imapHost,
      imapPort: legacy.imapPort,
      imapSecure: legacy.imapSecure,
      imapUser: legacy.imapUser,
      imapPass: legacy.imapPass,
    };
  }
  return null;
}

export async function sendCorporateEmail(input: SendEmailInput) {
  const workspaceId = input.workspaceId || (await getActiveWorkspaceId());
  const acc = await resolveMailAccount({
    workspaceId,
    accountId: input.fromAccountId,
    email: input.fromEmail,
  });

  if (!acc || !acc.smtpHost || !acc.smtpUser || !acc.smtpPass) {
    return {
      ok: true,
      simulated: true,
      fromEmail: input.fromEmail || "ventas@elcaminantecr.com",
      messageId: `sim-email-${Date.now()}`,
      info: "SMTP sin contraseña aún: correo guardado en historial en modo simulación.",
    };
  }

  const transporter = nodemailer.createTransport({
    host: acc.smtpHost,
    port: acc.smtpPort || 465,
    secure: acc.smtpSecure,
    auth: {
      user: acc.smtpUser,
      pass: acc.smtpPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const fromName = acc.fromName || "Caminante Corporativo";
  const fromEmail = acc.email || acc.smtpUser;

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  });

  return {
    ok: true,
    simulated: false,
    fromEmail,
    messageId: info.messageId || `smtp-${Date.now()}`,
    info: `Correo enviado correctamente desde ${fromEmail} vía SMTP.`,
  };
}

export async function testSmtpConnection(accountId?: string) {
  const workspaceId = await getActiveWorkspaceId();
  const acc = await resolveMailAccount({ workspaceId, accountId });
  if (!acc || !acc.smtpHost || !acc.smtpUser || !acc.smtpPass) {
    return { ok: false, error: "Completa servidor SMTP, usuario y contraseña primero." };
  }
  const transporter = nodemailer.createTransport({
    host: acc.smtpHost,
    port: acc.smtpPort || 465,
    secure: acc.smtpSecure,
    auth: { user: acc.smtpUser, pass: acc.smtpPass },
    tls: { rejectUnauthorized: false },
  });
  await transporter.verify();
  return {
    ok: true,
    message: `Conexión SMTP exitosa para ${acc.email} (${acc.smtpHost}:${acc.smtpPort})`,
  };
}

export async function testImapConnection(accountId?: string) {
  const workspaceId = await getActiveWorkspaceId();
  const acc = await resolveMailAccount({ workspaceId, accountId });
  if (!acc || !acc.imapHost || !acc.imapUser || !acc.imapPass) {
    return { ok: false, error: "Completa servidor IMAP, usuario y contraseña primero." };
  }
  const client = new ImapFlow({
    host: acc.imapHost,
    port: acc.imapPort || 993,
    secure: acc.imapSecure,
    auth: { user: acc.imapUser, pass: acc.imapPass },
    logger: false,
    tls: { rejectUnauthorized: false },
  });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  const total = client.mailbox ? client.mailbox.exists : 0;
  lock.release();
  await client.logout();
  return {
    ok: true,
    message: `Conexión IMAP exitosa para ${acc.email} (${total} correos en INBOX).`,
  };
}

async function syncSingleImapMailbox(
  acc: {
    id: string;
    workspaceId: string;
    email: string;
    imapHost: string;
    imapPort: number;
    imapSecure: boolean;
    imapUser: string;
    imapPass: string;
  },
  limit: number
) {
  const client = new ImapFlow({
    host: acc.imapHost,
    port: acc.imapPort || 993,
    secure: acc.imapSecure,
    auth: { user: acc.imapUser, pass: acc.imapPass },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  let synced = 0;

  try {
    const mailbox = client.mailbox;
    const total = mailbox ? mailbox.exists : 0;
    if (total > 0) {
      const startSeq = Math.max(1, total - limit + 1);
      for await (const msg of client.fetch(`${startSeq}:${total}`, { source: true, envelope: true })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const messageId = `${acc.email}::${parsed.messageId || `imap-${msg.uid}`}`;

        const exists = await prisma.message.findFirst({
          where: { externalMessageId: messageId },
        });
        if (exists) continue;

        const fromAddr = parsed.from?.value?.[0]?.address || "desconocido@correo.com";
        const fromName = parsed.from?.value?.[0]?.name || fromAddr;
        const subject = parsed.subject || "(Sin asunto)";
        const bodyText = (parsed.text || "").trim().slice(0, 4000) || "(Correo sin texto plano)";

        let crmClient = await prisma.client.findFirst({
          where: { workspaceId: acc.workspaceId, email: fromAddr },
        });
        if (!crmClient && fromAddr.toLowerCase() !== acc.email.toLowerCase()) {
          crmClient = await prisma.client.create({
            data: {
              workspaceId: acc.workspaceId,
              company: fromName,
              contactName: fromName,
              email: fromAddr,
              stage: "NUEVO",
              source: "CORREO",
              notes: `Recibido en ${acc.email} — Asunto: ${subject}`,
            },
          });
        }

        let conv = await prisma.conversation.findFirst({
          where: {
            workspaceId: acc.workspaceId,
            channel: "EMAIL",
            externalId: fromAddr,
            accountEmail: acc.email,
          },
        });
        if (!conv) {
          conv = await prisma.conversation.create({
            data: {
              workspaceId: acc.workspaceId,
              channel: "EMAIL",
              externalId: fromAddr,
              accountEmail: acc.email,
              subject,
              clientId: crmClient?.id,
              status: "ABIERTA",
              unreadCount: 1,
              lastMessageAt: parsed.date || new Date(),
              lastMessagePreview: bodyText.slice(0, 140),
            },
          });
        } else {
          await prisma.conversation.update({
            where: { id: conv.id },
            data: {
              subject,
              unreadCount: { increment: 1 },
              lastMessageAt: parsed.date || new Date(),
              lastMessagePreview: bodyText.slice(0, 140),
            },
          });
        }

        await prisma.message.create({
          data: {
            conversationId: conv.id,
            direction: "INBOUND",
            senderName: fromName,
            senderRole: "CLIENT",
            subject,
            body: bodyText,
            externalMessageId: messageId,
            status: "DELIVERED",
            createdAt: parsed.date || new Date(),
          },
        });
        synced++;
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }

  if (acc.id !== "legacy") {
    await prisma.emailAccount.update({
      where: { id: acc.id },
      data: { imapLastSyncAt: new Date() },
    });
  } else {
    await prisma.integrationSettings.update({
      where: { id: acc.workspaceId },
      data: { imapLastSyncAt: new Date() },
    });
  }

  return synced;
}

export async function syncCorporateInbox(limit = 15, accountId?: string) {
  const workspaceId = await getActiveWorkspaceId();

  const dbAccounts = await prisma.emailAccount.findMany({
    where: {
      workspaceId,
      active: true,
      ...(accountId ? { id: accountId } : {}),
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  const configured = dbAccounts.filter((a) => a.imapHost && a.imapUser && a.imapPass);

  if (configured.length === 0) {
    // Check legacy IntegrationSettings
    const legacy = await getIntegrationSettings(workspaceId);
    if (legacy.imapHost && legacy.imapUser && legacy.imapPass) {
      const synced = await syncSingleImapMailbox(
        {
          id: "legacy",
          workspaceId,
          email: legacy.imapUser,
          imapHost: legacy.imapHost,
          imapPort: legacy.imapPort,
          imapSecure: legacy.imapSecure,
          imapUser: legacy.imapUser,
          imapPass: legacy.imapPass,
        },
        limit
      );
      return {
        ok: true,
        synced,
        message: `Sincronización completada (${legacy.imapUser}): ${synced} correo(s) nuevo(s).`,
      };
    }

    return {
      ok: false,
      synced: 0,
      error: "Ingresa la contraseña de tus cuentas de correo en Conexiones y empresa → Correo SMTP / IMAP para sincronizar.",
    };
  }

  let totalSynced = 0;
  const details: string[] = [];

  for (const acc of configured) {
    try {
      const n = await syncSingleImapMailbox(acc, limit);
      totalSynced += n;
      details.push(`${acc.email}: ${n} nuevo(s)`);
    } catch (err) {
      details.push(`${acc.email}: error (${err instanceof Error ? err.message : "conexión"})`);
    }
  }

  return {
    ok: true,
    synced: totalSynced,
    message: `Sincronización lista — ${details.join(" | ")}`,
  };
}
