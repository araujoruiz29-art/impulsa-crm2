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
  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const alert = await prisma.sellerAlert.update({
    where: { id },
    data: {
      ...(body.read !== undefined ? { read: Boolean(body.read) } : {}),
      ...(body.resolved !== undefined ? { resolved: Boolean(body.resolved) } : {}),
    },
  });
  return NextResponse.json({ alert });
}
