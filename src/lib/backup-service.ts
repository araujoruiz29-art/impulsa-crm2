import { prisma } from "./prisma";
import { sendCorporateEmail } from "./email";

export async function buildBackupPayload(opts: {
  workspaceId: string;
  fullMigration: boolean;
}) {
  const { workspaceId, fullMigration } = opts;
  const whereWs = fullMigration ? {} : { workspaceId };
  const whereId = fullMigration ? {} : { id: workspaceId };

  const [
    users,
    company,
    integrations,
    emailAccounts,
    clients,
    products,
    quotes,
    conversations,
    rules,
    activities,
    documents,
    alerts,
    campaigns,
    sequences,
  ] = await Promise.all([
    fullMigration ? prisma.user.findMany() : Promise.resolve([]),
    prisma.companySettings.findMany({ where: whereId }),
    prisma.integrationSettings.findMany({ where: whereId }),
    prisma.emailAccount.findMany({ where: whereWs }),
    prisma.client.findMany({ where: whereWs }),
    prisma.product.findMany({ where: whereWs }),
    prisma.quote.findMany({ where: whereWs, include: { items: true } }),
    prisma.conversation.findMany({ where: whereWs, include: { messages: true } }),
    prisma.automationRule.findMany({ where: whereWs }),
    prisma.activity.findMany({ where: whereWs }),
    prisma.knowledgeDocument.findMany({ where: whereWs }),
    prisma.sellerAlert.findMany({ where: whereWs }),
    prisma.campaign.findMany({ where: whereWs }),
    prisma.followUpSequence.findMany({
      where: whereWs,
      include: { steps: true, enrollments: true },
    }),
  ]);

  const counts = {
    users: users.length,
    company: company.length,
    integrations: integrations.length,
    emailAccounts: emailAccounts.length,
    clients: clients.length,
    products: products.length,
    quotes: quotes.length,
    conversations: conversations.length,
    rules: rules.length,
    activities: activities.length,
    documents: documents.length,
    alerts: alerts.length,
    campaigns: campaigns.length,
    sequences: sequences.length,
  };

  return {
    payload: {
      exportedAt: new Date().toISOString(),
      version: 2,
      fullMigration,
      workspaceId: fullMigration ? "ALL" : workspaceId,
      app: "impulsa CRM Multiempresa",
      counts,
      users,
      company,
      integrations,
      emailAccounts,
      clients,
      products,
      quotes,
      conversations,
      rules,
      activities,
      documents,
      alerts,
      campaigns,
      sequences,
    },
    counts,
  };
}

export async function restoreBackupPayload(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  opts: { isSuperAdmin: boolean; activeWorkspaceId: string }
) {
  const { isSuperAdmin, activeWorkspaceId } = opts;
  const counts: Record<string, number> = {};

  const allowedWs = (rowWs: unknown) => {
    if (isSuperAdmin) return true;
    return String(rowWs || activeWorkspaceId) === activeWorkspaceId;
  };

  // Prevent non-SuperAdmin OWNER from overwriting an existing record belonging to another company
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canSafelyUpsert = async (model: any, id: unknown): Promise<boolean> => {
    if (isSuperAdmin) return true;
    if (!id) return true;
    const existing = await model.findUnique({
      where: { id: String(id) },
      select: { workspaceId: true },
    });
    return !existing || existing.workspaceId === activeWorkspaceId;
  };

  // Users: only SuperAdmin can restore user accounts
  if (isSuperAdmin && Array.isArray(data.users)) {
    for (const u of data.users) {
      const { updatedAt: _u, createdAt: _c, ...rest } = u;
      await prisma.user.upsert({
        where: { id: rest.id },
        update: rest,
        create: rest,
      });
    }
    counts.users = data.users.length;
  }

  if (Array.isArray(data.company)) {
    let n = 0;
    for (const c of data.company) {
      if (!isSuperAdmin && c.id !== activeWorkspaceId) continue;
      const { updatedAt: _u, createdAt: _c, ownerUserId: _owner, ...rest } = c;
      const safeData = isSuperAdmin ? { ...rest, ...(c.ownerUserId !== undefined ? { ownerUserId: c.ownerUserId } : {}) } : rest;
      await prisma.companySettings.upsert({
        where: { id: rest.id },
        update: safeData,
        create: safeData,
      });
      n++;
    }
    counts.company = n;
  }

  if (Array.isArray(data.integrations)) {
    let n = 0;
    for (const i of data.integrations) {
      if (!isSuperAdmin && i.id !== activeWorkspaceId) continue;
      const { updatedAt: _u, ...rest } = i;
      await prisma.integrationSettings.upsert({
        where: { id: rest.id },
        update: rest,
        create: rest,
      });
      n++;
    }
    counts.integrations = n;
  }

  if (Array.isArray(data.emailAccounts)) {
    let n = 0;
    for (const a of data.emailAccounts) {
      if (!allowedWs(a.workspaceId)) continue;
      if (!(await canSafelyUpsert(prisma.emailAccount, a.id))) continue;
      const { updatedAt: _u, createdAt: _c, ...rest } = a;
      const safeRest = isSuperAdmin ? rest : { ...rest, workspaceId: activeWorkspaceId };
      await prisma.emailAccount.upsert({
        where: { id: safeRest.id },
        update: safeRest,
        create: safeRest,
      });
      n++;
    }
    counts.emailAccounts = n;
  }

  if (Array.isArray(data.products)) {
    let n = 0;
    for (const p of data.products) {
      if (!allowedWs(p.workspaceId)) continue;
      if (!(await canSafelyUpsert(prisma.product, p.id))) continue;
      const { updatedAt: _u, createdAt: _c, ...rest } = p;
      const safeRest = isSuperAdmin ? rest : { ...rest, workspaceId: activeWorkspaceId };
      await prisma.product.upsert({
        where: { id: safeRest.id },
        update: safeRest,
        create: safeRest,
      });
      n++;
    }
    counts.products = n;
  }

  if (Array.isArray(data.clients)) {
    let n = 0;
    for (const cl of data.clients) {
      if (!allowedWs(cl.workspaceId)) continue;
      if (!(await canSafelyUpsert(prisma.client, cl.id))) continue;
      const { updatedAt: _u, createdAt: _c, ...rest } = cl;
      const safeRest = isSuperAdmin ? rest : { ...rest, workspaceId: activeWorkspaceId };
      await prisma.client.upsert({
        where: { id: safeRest.id },
        update: safeRest,
        create: safeRest,
      });
      n++;
    }
    counts.clients = n;
  }

  if (Array.isArray(data.quotes)) {
    let n = 0;
    for (const q of data.quotes) {
      if (!allowedWs(q.workspaceId)) continue;
      if (!(await canSafelyUpsert(prisma.quote, q.id))) continue;
      const { items, updatedAt: _u, createdAt: _c, ...rest } = q;
      const safeRest = isSuperAdmin ? rest : { ...rest, workspaceId: activeWorkspaceId };
      await prisma.quote.upsert({
        where: { id: safeRest.id },
        update: safeRest,
        create: safeRest,
      });
      if (Array.isArray(items)) {
        await prisma.quoteItem.deleteMany({ where: { quoteId: safeRest.id } });
        for (const it of items) {
          await prisma.quoteItem.create({ data: { ...it, quoteId: safeRest.id } });
        }
      }
      n++;
    }
    counts.quotes = n;
  }

  if (Array.isArray(data.conversations)) {
    let n = 0;
    for (const conv of data.conversations) {
      if (!allowedWs(conv.workspaceId)) continue;
      if (!(await canSafelyUpsert(prisma.conversation, conv.id))) continue;
      const { messages, updatedAt: _u, createdAt: _c, ...rest } = conv;
      const safeRest = isSuperAdmin ? rest : { ...rest, workspaceId: activeWorkspaceId };
      await prisma.conversation.upsert({
        where: { id: safeRest.id },
        update: safeRest,
        create: safeRest,
      });
      if (Array.isArray(messages)) {
        for (const m of messages) {
          await prisma.message.upsert({
            where: { id: m.id },
            update: { ...m, conversationId: safeRest.id },
            create: { ...m, conversationId: safeRest.id },
          });
        }
      }
      n++;
    }
    counts.conversations = n;
  }

  if (Array.isArray(data.documents)) {
    let n = 0;
    for (const d of data.documents) {
      if (!allowedWs(d.workspaceId)) continue;
      if (!(await canSafelyUpsert(prisma.knowledgeDocument, d.id))) continue;
      const { updatedAt: _u, createdAt: _c, ...rest } = d;
      const safeRest = isSuperAdmin ? rest : { ...rest, workspaceId: activeWorkspaceId };
      await prisma.knowledgeDocument.upsert({
        where: { id: safeRest.id },
        update: safeRest,
        create: safeRest,
      });
      n++;
    }
    counts.documents = n;
  }

  if (Array.isArray(data.rules)) {
    let n = 0;
    for (const r of data.rules) {
      if (!allowedWs(r.workspaceId)) continue;
      if (!(await canSafelyUpsert(prisma.automationRule, r.id))) continue;
      const { updatedAt: _u, createdAt: _c, ...rest } = r;
      const safeRest = isSuperAdmin ? rest : { ...rest, workspaceId: activeWorkspaceId };
      await prisma.automationRule.upsert({
        where: { id: safeRest.id },
        update: safeRest,
        create: safeRest,
      });
      n++;
    }
    counts.rules = n;
  }

  if (Array.isArray(data.activities)) {
    let n = 0;
    for (const act of data.activities) {
      if (!allowedWs(act.workspaceId)) continue;
      if (!(await canSafelyUpsert(prisma.activity, act.id))) continue;
      const safeRest = isSuperAdmin ? act : { ...act, workspaceId: activeWorkspaceId };
      await prisma.activity.upsert({
        where: { id: safeRest.id },
        update: safeRest,
        create: safeRest,
      });
      n++;
    }
    counts.activities = n;
  }

  if (Array.isArray(data.alerts)) {
    let n = 0;
    for (const al of data.alerts) {
      if (!allowedWs(al.workspaceId)) continue;
      if (!(await canSafelyUpsert(prisma.sellerAlert, al.id))) continue;
      const safeRest = isSuperAdmin ? al : { ...al, workspaceId: activeWorkspaceId };
      await prisma.sellerAlert.upsert({
        where: { id: safeRest.id },
        update: safeRest,
        create: safeRest,
      });
      n++;
    }
    counts.alerts = n;
  }

  if (Array.isArray(data.campaigns)) {
    let n = 0;
    for (const camp of data.campaigns) {
      if (!allowedWs(camp.workspaceId)) continue;
      if (!(await canSafelyUpsert(prisma.campaign, camp.id))) continue;
      const { updatedAt: _u, createdAt: _c, ...rest } = camp;
      const safeRest = isSuperAdmin ? rest : { ...rest, workspaceId: activeWorkspaceId };
      await prisma.campaign.upsert({
        where: { id: safeRest.id },
        update: safeRest,
        create: safeRest,
      });
      n++;
    }
    counts.campaigns = n;
  }

  if (Array.isArray(data.sequences)) {
    let n = 0;
    for (const seq of data.sequences) {
      if (!allowedWs(seq.workspaceId)) continue;
      if (!(await canSafelyUpsert(prisma.followUpSequence, seq.id))) continue;
      const { steps, enrollments, updatedAt: _u, createdAt: _c, ...rest } = seq;
      const safeRest = isSuperAdmin ? rest : { ...rest, workspaceId: activeWorkspaceId };
      await prisma.followUpSequence.upsert({
        where: { id: safeRest.id },
        update: safeRest,
        create: safeRest,
      });
      if (Array.isArray(steps)) {
        for (const st of steps) {
          const { createdAt: _sc, ...stRest } = st;
          await prisma.sequenceStep.upsert({
            where: { id: stRest.id },
            update: { ...stRest, sequenceId: safeRest.id },
            create: { ...stRest, sequenceId: safeRest.id },
          });
        }
      }
      if (Array.isArray(enrollments)) {
        for (const en of enrollments) {
          if (!(await canSafelyUpsert(prisma.sequenceEnrollment, en.id))) continue;
          const { createdAt: _ec, updatedAt: _eu, ...enRest } = en;
          const safeEn = isSuperAdmin
            ? { ...enRest, sequenceId: safeRest.id }
            : { ...enRest, sequenceId: safeRest.id, workspaceId: activeWorkspaceId };
          await prisma.sequenceEnrollment.upsert({
            where: { id: safeEn.id },
            update: safeEn,
            create: safeEn,
          });
        }
      }
      n++;
    }
    counts.sequences = n;
  }

  return counts;
}

export async function emailBackupSnapshot(opts: {
  workspaceId: string;
  fullMigration: boolean;
  toEmail?: string;
}) {
  const { workspaceId, fullMigration } = opts;
  const companyRow = await prisma.companySettings.findUnique({ where: { id: workspaceId } });
  const recipient = (opts.toEmail || companyRow?.email || process.env.CRM_ADMIN_EMAIL || "").trim();

  if (!recipient) {
    return {
      ok: false,
      error: "Configura un correo de empresa en «Empresa y Proforma» para recibir el respaldo.",
    };
  }

  const { payload, counts } = await buildBackupPayload({ workspaceId, fullMigration });
  const dateStamp = new Date().toISOString().slice(0, 10);
  const label = fullMigration ? "migracion-completa" : workspaceId;
  const filename = `respaldo-${label}-${dateStamp}.json`;
  const jsonBuffer = Buffer.from(JSON.stringify(payload, null, 2), "utf8");

  const brand = fullMigration
    ? "Todas las empresas (Respaldo Maestro)"
    : companyRow?.brandName || companyRow?.companyName || workspaceId;

  const summaryLines = [
    `Respaldo automático de impulsa CRM — ${brand}`,
    `Fecha: ${dateStamp}`,
    ``,
    `Contenido respaldado:`,
    `- Empresas: ${counts.company}`,
    `- Clientes y contactos: ${counts.clients}`,
    `- Conversaciones (con historial completo): ${counts.conversations}`,
    `- Proformas PDF: ${counts.quotes}`,
    `- Productos de catálogo: ${counts.products}`,
    `- Campañas: ${counts.campaigns}`,
    `- Secuencias Ciclo 1-7-90: ${counts.sequences}`,
    `- Documentos IA: ${counts.documents}`,
    `- Tareas / Agenda: ${counts.activities}`,
    ``,
    `Guarda este archivo adjunto (.json) en Google Drive o OneDrive. Para restaurarlo en cualquier momento, entra a impulsa CRM → Conexiones y empresa → Respaldos y Nube → «Subir archivo de respaldo JSON».`,
  ].join("\n");

  const mail = await sendCorporateEmail({
    workspaceId,
    to: recipient,
    subject: `🛡️ Respaldo impulsa CRM (${brand}) — ${dateStamp}`,
    text: summaryLines,
    attachments: [
      {
        filename,
        content: jsonBuffer,
        contentType: "application/json",
      },
    ],
  });

  if (mail.simulated) {
    return {
      ok: false,
      error:
        "No hay cuenta SMTP activa en esta empresa para enviar el correo. Configura SMTP en «Correo SMTP / IMAP» o descarga el respaldo manualmente.",
    };
  }

  return {
    ok: true,
    recipient,
    filename,
    sizeKb: Math.round(jsonBuffer.length / 1024),
    counts,
    message: `Respaldo (${Math.round(jsonBuffer.length / 1024)} KB) enviado a ${recipient} (${counts.clients} clientes, ${counts.conversations} chats, ${counts.quotes} proformas).`,
  };
}
