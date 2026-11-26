import { NextResponse } from "next/server";
import { getCompanySettings, getIntegrationSettings, prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const [
      company,
      integrations,
      clients,
      quotes,
      conversations,
      pendingTasks,
      recentLogs,
      productsCount,
      activeRulesCount,
      knowledgeCount,
      sellerAlerts,
    ] = await Promise.all([
      getCompanySettings(workspaceId),
      getIntegrationSettings(workspaceId),
      prisma.client.findMany({
        where: { workspaceId, contactType: "CLIENTE" },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.quote.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        include: { items: true },
        take: 25,
      }),
      prisma.conversation.findMany({
        where: { workspaceId },
        orderBy: { lastMessageAt: "desc" },
        include: { client: true },
        take: 15,
      }),
      prisma.activity.findMany({
        where: { workspaceId, completed: false },
        orderBy: { dueDate: "asc" },
        include: { client: true },
        take: 10,
      }),
      prisma.automationLog.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.product.count({ where: { workspaceId, active: true } }),
      prisma.automationRule.count({ where: { workspaceId, active: true } }),
      prisma.knowledgeDocument.count({ where: { workspaceId, active: true } }),
      prisma.sellerAlert.findMany({
        where: { workspaceId, resolved: false },
        include: { client: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    const totalClients = clients.length;
    const unreadMessages = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
    const openPipelineValue = clients
      .filter((c) => !["GANADO", "PERDIDO"].includes(c.stage))
      .reduce((acc, c) => acc + (c.estimatedValue || 0), 0);

    const quotesSentTotal = quotes
      .filter((q) => ["ENVIADA", "SEGUIMIENTO"].includes(q.status))
      .reduce((acc, q) => acc + q.total, 0);

    const wonTotal = quotes
      .filter((q) => q.status === "APROBADA")
      .reduce((acc, q) => acc + q.total, 0);

    const byStage = clients.reduce<Record<string, { count: number; value: number }>>((acc, c) => {
      if (!acc[c.stage]) acc[c.stage] = { count: 0, value: 0 };
      acc[c.stage].count += 1;
      acc[c.stage].value += c.estimatedValue || 0;
      return acc;
    }, {});

    // Find bottleneck stage (where open deals are stalling the most)
    const openStages = ["NUEVO", "CONTACTADO", "COTIZADO", "SEGUIMIENTO", "NEGOCIACION"];
    let bottleneckStage = { stage: "COTIZADO", count: 0, value: 0 };
    for (const st of openStages) {
      const info = byStage[st] || { count: 0, value: 0 };
      if (info.value > bottleneckStage.value || (info.value === bottleneckStage.value && info.count > bottleneckStage.count)) {
        bottleneckStage = { stage: st, count: info.count, value: info.value };
      }
    }

    const bySource = clients.reduce<Record<string, number>>((acc, c) => {
      acc[c.source] = (acc[c.source] || 0) + 1;
      return acc;
    }, {});

    const emailAccountsConfigured = await prisma.emailAccount.count({
      where: { workspaceId, active: true, smtpPass: { not: "" } },
    });

    const connections = {
      whatsappConnected: Boolean(integrations.metaAccessToken && integrations.metaPhoneNumberId),
      emailConnected: Boolean((integrations.smtpHost && integrations.smtpUser && integrations.smtpPass) || emailAccountsConfigured > 0),
      aiConnected: Boolean(integrations.aiApiKey),
      companyName: company.brandName,
    };

    const onboardingSteps = [
      {
        id: "whatsapp",
        label: "1. Conectar WhatsApp (Meta Cloud API)",
        done: connections.whatsappConnected,
        href: "/configuracion",
      },
      {
        id: "docs",
        label: "2. Cargar información y documentos del negocio",
        done: knowledgeCount > 0,
        href: "/conocimiento",
      },
      {
        id: "assistant",
        label: "3. Activar asistente IA (responde, audios, califica y sigue)",
        done: activeRulesCount > 0,
        href: "/automatizaciones",
      },
      {
        id: "alerts",
        label: "4. Avisos al vendedor cuando el cliente está listo para comprar",
        done: true,
        href: "/avisos",
      },
      {
        id: "dashboard",
        label: "5. Ver resultados y embudo en el Tablero",
        done: totalClients > 0,
        href: "/embudo",
      },
    ];

    return NextResponse.json({
      kpis: {
        totalClients,
        openPipelineValue,
        quotesCount: quotes.length,
        quotesSentTotal,
        wonTotal,
        unreadMessages,
        pendingTasksCount: pendingTasks.length,
        productsCount,
        activeRulesCount,
        knowledgeCount,
        openAlertsCount: sellerAlerts.length,
      },
      connections,
      onboardingSteps,
      bottleneckStage,
      byStage,
      bySource,
      recentQuotes: quotes.slice(0, 8),
      recentConversations: conversations.slice(0, 6),
      pendingTasks,
      recentLogs,
      sellerAlerts,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return NextResponse.json({ error: "Error cargando tablero" }, { status: 500 });
  }
}
