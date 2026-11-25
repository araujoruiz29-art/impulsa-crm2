import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runScheduledFollowUps } from "@/lib/automations";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET() {
  const workspaceId = await getActiveWorkspaceId();
  const [rules, logs] = await Promise.all([
    prisma.automationRule.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } }),
    prisma.automationLog.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  return NextResponse.json({ rules, logs });
}

export async function POST(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const body = await req.json();

  if (body.action === "run_followups") {
    const executed = await runScheduledFollowUps();
    return NextResponse.json({ ok: true, executed, count: executed.length });
  }

  const rule = await prisma.automationRule.create({
    data: {
      workspaceId,
      name: String(body.name || "Nueva automatización"),
      description: String(body.description || ""),
      trigger: String(body.trigger || "NEW_WHATSAPP_MESSAGE"),
      channel: String(body.channel || "WHATSAPP"),
      delayHours: Number(body.delayHours) || 0,
      actionType: String(body.actionType || "SEND_TEMPLATE"),
      templateText: String(body.templateText || ""),
      targetStage: String(body.targetStage || ""),
      active: body.active !== false,
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}
