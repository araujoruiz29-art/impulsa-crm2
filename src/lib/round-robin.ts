import { getCompanySettings, prisma } from "./prisma";

export async function pickNextRoundRobinAgent(workspaceId: string): Promise<{
  userId: string;
  agentName: string;
} | null> {
  const company = await getCompanySettings(workspaceId);
  if (!company.roundRobinEnabled) return null;

  const agents = await prisma.user.findMany({
    where: { workspaceId, role: "AGENT", active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true },
  });

  if (agents.length === 0) {
    return { userId: "owner", agentName: company.defaultSeller || "Asesor" };
  }

  const idx = Math.abs(company.roundRobinIndex || 0) % agents.length;
  const chosen = agents[idx];

  await prisma.companySettings.update({
    where: { id: workspaceId },
    data: { roundRobinIndex: (idx + 1) % agents.length },
  });

  return {
    userId: chosen.id,
    agentName: chosen.name || chosen.email,
  };
}

export async function computeWorkspaceSlaStats(workspaceId: string) {
  const convs = await prisma.conversation.findMany({
    where: {
      workspaceId,
      firstInboundAt: { not: null },
      firstAgentReplyAt: { not: null },
    },
    select: {
      assignedAgentName: true,
      firstInboundAt: true,
      firstAgentReplyAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const byAgent = new Map<string, { count: number; totalMinutes: number }>();
  let totalMinutesAll = 0;
  let validCount = 0;

  for (const c of convs) {
    if (!c.firstInboundAt || !c.firstAgentReplyAt) continue;
    const diffMin = Math.max(
      0,
      (c.firstAgentReplyAt.getTime() - c.firstInboundAt.getTime()) / 60000
    );
    if (diffMin > 60 * 72) continue; // ignore outliers > 72h
    totalMinutesAll += diffMin;
    validCount += 1;

    const agent = c.assignedAgentName || "Sin asignar";
    const prev = byAgent.get(agent) || { count: 0, totalMinutes: 0 };
    byAgent.set(agent, { count: prev.count + 1, totalMinutes: prev.totalMinutes + diffMin });
  }

  return {
    avgFirstResponseMinutes: validCount > 0 ? Math.round(totalMinutesAll / validCount) : null,
    measuredConversations: validCount,
    byAgent: Array.from(byAgent.entries()).map(([agentName, st]) => ({
      agentName,
      conversations: st.count,
      avgMinutes: Math.round(st.totalMinutes / st.count),
    })),
  };
}
