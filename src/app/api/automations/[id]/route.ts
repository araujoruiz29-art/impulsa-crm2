import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const workspaceId = await getActiveWorkspaceId();
  const { id } = await context.params;
  const body = await req.json();

  const existing = await prisma.automationRule.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Regla no encontrada." }, { status: 404 });
  }

  const rule = await prisma.automationRule.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.description !== undefined ? { description: String(body.description) } : {}),
      ...(body.trigger !== undefined ? { trigger: String(body.trigger) } : {}),
      ...(body.channel !== undefined ? { channel: String(body.channel) } : {}),
      ...(body.delayHours !== undefined ? { delayHours: Number(body.delayHours) || 0 } : {}),
      ...(body.actionType !== undefined ? { actionType: String(body.actionType) } : {}),
      ...(body.templateText !== undefined ? { templateText: String(body.templateText) } : {}),
      ...(body.targetStage !== undefined ? { targetStage: String(body.targetStage) } : {}),
      ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    },
  });

  return NextResponse.json({ rule });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const workspaceId = await getActiveWorkspaceId();
  const { id } = await context.params;
  const deleted = await prisma.automationRule.deleteMany({ where: { id, workspaceId } });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Regla no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
