import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerOrAdmin } from "@/lib/workspace";
import { sendWeeklyExecutiveReport } from "@/lib/weekly-report";
import { emitOutboundWebhook } from "@/lib/outbound-webhook";
import { computeWorkspaceSlaStats } from "@/lib/round-robin";

// GET: Audit logs + SLA stats + upcoming Bookings (OWNER / SUPERADMIN only)
export async function GET() {
  const guard = await requireOwnerOrAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const workspaceId = guard.workspaceId;

  const [logs, sla, bookings] = await Promise.all([
    prisma.auditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    computeWorkspaceSlaStats(workspaceId),
    prisma.booking.findMany({
      where: { workspaceId },
      orderBy: { startsAt: "desc" },
      take: 25,
    }),
  ]);

  return NextResponse.json({ ok: true, workspaceId, logs, sla, bookings });
}

// POST: Trigger Weekly Executive Report now OR send test Outbound Webhook (Odoo / n8n / Zapier)
export async function POST(req: NextRequest) {
  const guard = await requireOwnerOrAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const workspaceId = guard.workspaceId;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "weekly_report");

  if (action === "test_webhook") {
    const res = await emitOutboundWebhook({
      workspaceId,
      event: "CLIENT_CREATED",
      payload: {
        test: true,
        message: "Evento de prueba desde impulsa CRM (compatible con Odoo, n8n, Zapier y Make).",
        company: "Cliente de Prueba S.A.",
        stage: "NUEVO",
      },
    });
    if (res.skipped) {
      return NextResponse.json(
        { ok: false, error: "Guarda primero una URL HTTPS válida en Webhook de Salida." },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      message: res.ok
        ? `✅ Webhook de prueba enviado correctamente (HTTP ${res.status}).`
        : `⚠️ El servidor destino respondió error (${res.status || res.error}).`,
    });
  }

  const report = await sendWeeklyExecutiveReport({
    workspaceId,
    toEmail: typeof body.toEmail === "string" ? body.toEmail : undefined,
  });
  return NextResponse.json(report, { status: report.ok ? 200 : 400 });
}
