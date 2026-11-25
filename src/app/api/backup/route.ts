import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId, getCurrentSession } from "@/lib/workspace";

// GET: Download backup JSON (?full=1 is restricted to SUPERADMIN; OWNER exports only their own workspace)
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  const isSuperAdmin = !session || session.role === "SUPERADMIN";
  const { searchParams } = new URL(req.url);
  const fullMigration = searchParams.get("full") === "1" && isSuperAdmin;
  const workspaceId = await getActiveWorkspaceId();
  const whereWs = fullMigration ? {} : { workspaceId };
  const whereId = fullMigration ? {} : { id: workspaceId };

  const [
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
  ] = await Promise.all([
    prisma.companySettings.findMany({ where: whereId }),
    fullMigration ? prisma.integrationSettings.findMany() : Promise.resolve([]),
    prisma.emailAccount.findMany({ where: whereWs }),
    prisma.client.findMany({ where: whereWs }),
    prisma.product.findMany({ where: whereWs }),
    prisma.quote.findMany({ where: whereWs, include: { items: true } }),
    prisma.conversation.findMany({ where: whereWs, include: { messages: true } }),
    prisma.automationRule.findMany({ where: whereWs }),
    prisma.activity.findMany({ where: whereWs }),
    prisma.knowledgeDocument.findMany({ where: whereWs }),
    prisma.sellerAlert.findMany({ where: whereWs }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    fullMigration,
    workspaceId: fullMigration ? "ALL" : workspaceId,
    app: "impulsa CRM Multiempresa",
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
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="respaldo-${
        fullMigration ? "migracion-completa" : workspaceId
      }-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

// POST: Restore / Import a full migration backup JSON (restricted to SUPERADMIN)
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (session && session.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Solo el administrador principal puede restaurar migraciones completas." },
        { status: 403 }
      );
    }
    const data = await req.json();
    const counts: Record<string, number> = {};

    if (Array.isArray(data.company)) {
      for (const c of data.company) {
        const { updatedAt: _u, createdAt: _c, ...rest } = c;
        await prisma.companySettings.upsert({
          where: { id: rest.id },
          update: rest,
          create: rest,
        });
      }
      counts.company = data.company.length;
    }

    if (Array.isArray(data.integrations)) {
      for (const i of data.integrations) {
        const { updatedAt: _u, ...rest } = i;
        await prisma.integrationSettings.upsert({
          where: { id: rest.id },
          update: rest,
          create: rest,
        });
      }
      counts.integrations = data.integrations.length;
    }

    if (Array.isArray(data.emailAccounts)) {
      for (const a of data.emailAccounts) {
        const { updatedAt: _u, createdAt: _c, ...rest } = a;
        await prisma.emailAccount.upsert({
          where: { id: rest.id },
          update: rest,
          create: rest,
        });
      }
      counts.emailAccounts = data.emailAccounts.length;
    }

    if (Array.isArray(data.products)) {
      for (const p of data.products) {
        const { updatedAt: _u, createdAt: _c, ...rest } = p;
        await prisma.product.upsert({
          where: { id: rest.id },
          update: rest,
          create: rest,
        });
      }
      counts.products = data.products.length;
    }

    if (Array.isArray(data.clients)) {
      for (const cl of data.clients) {
        const { updatedAt: _u, createdAt: _c, ...rest } = cl;
        await prisma.client.upsert({
          where: { id: rest.id },
          update: rest,
          create: rest,
        });
      }
      counts.clients = data.clients.length;
    }

    if (Array.isArray(data.quotes)) {
      for (const q of data.quotes) {
        const { items, updatedAt: _u, createdAt: _c, ...rest } = q;
        await prisma.quote.upsert({
          where: { id: rest.id },
          update: rest,
          create: rest,
        });
        if (Array.isArray(items)) {
          await prisma.quoteItem.deleteMany({ where: { quoteId: rest.id } });
          for (const it of items) {
            await prisma.quoteItem.create({ data: it });
          }
        }
      }
      counts.quotes = data.quotes.length;
    }

    if (Array.isArray(data.conversations)) {
      for (const conv of data.conversations) {
        const { messages, updatedAt: _u, createdAt: _c, ...rest } = conv;
        await prisma.conversation.upsert({
          where: { id: rest.id },
          update: rest,
          create: rest,
        });
        if (Array.isArray(messages)) {
          for (const m of messages) {
            await prisma.message.upsert({
              where: { id: m.id },
              update: m,
              create: m,
            });
          }
        }
      }
      counts.conversations = data.conversations.length;
    }

    if (Array.isArray(data.documents)) {
      for (const d of data.documents) {
        const { updatedAt: _u, createdAt: _c, ...rest } = d;
        await prisma.knowledgeDocument.upsert({
          where: { id: rest.id },
          update: rest,
          create: rest,
        });
      }
      counts.documents = data.documents.length;
    }

    if (Array.isArray(data.rules)) {
      for (const r of data.rules) {
        const { updatedAt: _u, createdAt: _c, ...rest } = r;
        await prisma.automationRule.upsert({
          where: { id: rest.id },
          update: rest,
          create: rest,
        });
      }
      counts.rules = data.rules.length;
    }

    if (Array.isArray(data.activities)) {
      for (const act of data.activities) {
        await prisma.activity.upsert({
          where: { id: act.id },
          update: act,
          create: act,
        });
      }
      counts.activities = data.activities.length;
    }

    if (Array.isArray(data.alerts)) {
      for (const al of data.alerts) {
        await prisma.sellerAlert.upsert({
          where: { id: al.id },
          update: al,
          create: al,
        });
      }
      counts.alerts = data.alerts.length;
    }

    return NextResponse.json({
      ok: true,
      message: "Migración / restauración completada con éxito.",
      counts,
    });
  } catch (err) {
    console.error("Restore backup error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error restaurando respaldo JSON." },
      { status: 500 }
    );
  }
}
