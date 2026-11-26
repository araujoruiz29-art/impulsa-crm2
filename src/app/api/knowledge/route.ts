import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET() {
  const workspaceId = await getActiveWorkspaceId();
  const documents = await prisma.knowledgeDocument.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const body = await req.json();
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    if (!title || !content) {
      return NextResponse.json({ error: "Título y contenido son obligatorios." }, { status: 400 });
    }

    const doc = await prisma.knowledgeDocument.create({
      data: {
        workspaceId,
        title,
        category: String(body.category || "Políticas"),
        fileName: String(body.fileName || ""),
        content,
        active: body.active !== false,
      },
    });
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error guardando documento." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const existing = await prisma.knowledgeDocument.findFirst({ where: { id, workspaceId } });
  if (!existing) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  const doc = await prisma.knowledgeDocument.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: String(body.title) } : {}),
      ...(body.category !== undefined ? { category: String(body.category) } : {}),
      ...(body.content !== undefined ? { content: String(body.content) } : {}),
      ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    },
  });
  return NextResponse.json({ document: doc });
}

export async function DELETE(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  await prisma.knowledgeDocument.deleteMany({ where: { id, workspaceId } });
  return NextResponse.json({ ok: true });
}
