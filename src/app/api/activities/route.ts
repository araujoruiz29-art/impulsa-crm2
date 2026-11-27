import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function POST(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const body = await req.json();
  const activity = await prisma.activity.create({
    data: {
      workspaceId,
      clientId: body.clientId ? String(body.clientId) : null,
      quoteId: body.quoteId ? String(body.quoteId) : null,
      type: String(body.type || "TAREA"),
      title: String(body.title || "Seguimiento"),
      description: String(body.description || ""),
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      completed: Boolean(body.completed),
    },
  });
  return NextResponse.json({ activity }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const existing = await prisma.activity.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Actividad no encontrada." }, { status: 404 });
  }

  const activity = await prisma.activity.update({
    where: { id },
    data: { completed: Boolean(body.completed) },
  });
  return NextResponse.json({ activity });
}
