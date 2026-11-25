import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET() {
  const workspaceId = await getActiveWorkspaceId();
  const alerts = await prisma.sellerAlert.findMany({
    where: { workspaceId },
    include: { client: true },
    orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
    take: 50,
  });
  const unreadCount = alerts.filter((a) => !a.resolved).length;
  return NextResponse.json({ alerts, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const existing = await prisma.sellerAlert.findFirst({
    where: { id, workspaceId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Aviso no encontrado" }, { status: 404 });
  }

  const alert = await prisma.sellerAlert.update({
    where: { id },
    data: {
      ...(body.read !== undefined ? { read: Boolean(body.read) } : {}),
      ...(body.resolved !== undefined ? { resolved: Boolean(body.resolved) } : {}),
    },
  });

  // Optionally re-enable AI bot on the linked conversation when marking resolved
  if (body.reactivateAi && existing.conversationId) {
    await prisma.conversation.updateMany({
      where: { id: existing.conversationId, workspaceId },
      data: { aiEnabled: true },
    });
  }

  return NextResponse.json({ alert });
}

export async function DELETE(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") || "").trim();
  const clearResolved = searchParams.get("resolved") === "1";

  if (clearResolved) {
    const del = await prisma.sellerAlert.deleteMany({
      where: { workspaceId, resolved: true },
    });
    return NextResponse.json({ ok: true, deleted: del.count });
  }

  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  await prisma.sellerAlert.deleteMany({
    where: { id, workspaceId },
  });
  return NextResponse.json({ ok: true, deleted: 1 });
}
