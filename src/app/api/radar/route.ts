import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerOrAdmin } from "@/lib/workspace";
import { runInnovationRadarScan } from "@/lib/innovation-radar";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  const guard = await requireOwnerOrAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const items = await prisma.innovationRadarItem.findMany({
    where: { workspaceId: guard.workspaceId },
    orderBy: [{ status: "asc" }, { discoveredAt: "desc" }],
    take: 50,
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST() {
  const guard = await requireOwnerOrAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const res = await runInnovationRadarScan(guard.workspaceId);
  if (res.ok) {
    await logAuditEvent({
      workspaceId: guard.workspaceId,
      action: "INNOVATION_RADAR_SCAN",
      entityType: "InnovationRadar",
      summary: `Escaneó la web con Radar IA (${res.usedLiveSearch ? "Google Search en vivo" : "IA"}): ${res.addedCount} mejoras nuevas detectadas.`,
    });
  }
  return NextResponse.json(
    {
      ...res,
      message: res.ok
        ? `🛰️ Escaneo completado (${res.usedLiveSearch ? "búsqueda en vivo en Google" : "análisis IA"}): ${res.addedCount} mejora(s) nueva(s) agregada(s) a tu base.`
        : res.error,
    },
    { status: res.ok ? 200 : 400 }
  );
}

export async function PATCH(req: NextRequest) {
  const guard = await requireOwnerOrAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const body = await req.json();
  const id = String(body.id || "");
  const status = String(body.status || "");
  if (!id || !["NUEVA", "APROBADA", "IMPLEMENTADA", "DESCARTADA"].includes(status)) {
    return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  }
  await prisma.innovationRadarItem.updateMany({
    where: { id, workspaceId: guard.workspaceId },
    data: { status },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireOwnerOrAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });
  await prisma.innovationRadarItem.deleteMany({ where: { id, workspaceId: guard.workspaceId } });
  return NextResponse.json({ ok: true });
}
