import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId, getCurrentSession } from "@/lib/workspace";
import { logAuditEvent } from "@/lib/audit";
import { emitOutboundWebhook } from "@/lib/outbound-webhook";
import { formatMoney } from "@/lib/format";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const workspaceId = await getActiveWorkspaceId();
  const { id } = await context.params;
  const quote = await prisma.quote.findFirst({
    where: { id, workspaceId },
    select: { id: true, number: true, total: true, paidAmount: true, currency: true },
  });
  if (!quote) {
    return NextResponse.json({ error: "Proforma no encontrada." }, { status: 404 });
  }
  const payments = await prisma.quotePayment.findMany({
    where: { quoteId: quote.id, workspaceId },
    orderBy: { paidAt: "desc" },
  });
  const balance = Math.max(0, Number((quote.total - (quote.paidAmount || 0)).toFixed(2)));
  return NextResponse.json({ quote, payments, balance });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const session = await getCurrentSession();
    const { id } = await context.params;
    const body = await req.json();

    const quote = await prisma.quote.findFirst({ where: { id, workspaceId } });
    if (!quote) {
      return NextResponse.json({ error: "Proforma no encontrada." }, { status: 404 });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Ingresa un monto de abono válido mayor a 0." }, { status: 400 });
    }

    const method = ["SINPE", "TRANSFERENCIA", "TARJETA", "EFECTIVO"].includes(String(body.method))
      ? String(body.method)
      : "SINPE";
    const reference = String(body.reference || "").trim();
    const notes = String(body.notes || "").trim();

    const payment = await prisma.quotePayment.create({
      data: {
        workspaceId,
        quoteId: quote.id,
        amount,
        method,
        reference,
        notes,
        recordedBy: session?.email || "usuario",
      },
    });

    const allPayments = await prisma.quotePayment.findMany({
      where: { quoteId: quote.id, workspaceId },
      select: { amount: true },
    });
    const newPaid = Number(allPayments.reduce((s, p) => s + (p.amount || 0), 0).toFixed(2));
    const balance = Math.max(0, Number((quote.total - newPaid).toFixed(2)));

    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        paidAmount: newPaid,
        status: newPaid > 0 ? "APROBADA" : quote.status,
      },
    });

    if (quote.clientId) {
      await prisma.client.updateMany({
        where: { id: quote.clientId, workspaceId },
        data: { stage: "GANADO", estimatedValue: quote.total },
      });
      await prisma.activity.create({
        data: {
          workspaceId,
          clientId: quote.clientId,
          quoteId: quote.id,
          type: "NOTA",
          title: `💰 Abono registrado (${method}): ${formatMoney(amount, quote.currency)}`,
          description: `Proforma #${quote.number} · Ref: ${reference || "N/A"} · Saldo pendiente: ${formatMoney(
            balance,
            quote.currency
          )}`,
          completed: true,
        },
      });
    }

    await logAuditEvent({
      workspaceId,
      action: "QUOTE_PAYMENT_ADDED",
      entityType: "Quote",
      entityId: quote.id,
      summary: `Registró abono ${method} de ${formatMoney(amount, quote.currency)} a Proforma #${quote.number} (saldo ${formatMoney(balance, quote.currency)})`,
    });

    emitOutboundWebhook({
      workspaceId,
      event: "PAYMENT_RECEIVED",
      payload: {
        quoteId: quote.id,
        quoteNumber: quote.number,
        clientCompany: quote.clientCompany,
        amount,
        method,
        reference,
        totalPaid: newPaid,
        balance,
        currency: quote.currency,
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, payment, paidAmount: newPaid, balance }, { status: 201 });
  } catch (err) {
    console.error("Add quote payment error:", err);
    return NextResponse.json({ error: "No se pudo registrar el abono." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const workspaceId = await getActiveWorkspaceId();
  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const paymentId = searchParams.get("paymentId") || "";
  if (!paymentId) return NextResponse.json({ error: "Falta paymentId" }, { status: 400 });

  await prisma.quotePayment.deleteMany({ where: { id: paymentId, quoteId: id, workspaceId } });
  const remaining = await prisma.quotePayment.findMany({
    where: { quoteId: id, workspaceId },
    select: { amount: true },
  });
  const newPaid = Number(remaining.reduce((s, p) => s + (p.amount || 0), 0).toFixed(2));
  await prisma.quote.updateMany({ where: { id, workspaceId }, data: { paidAmount: newPaid } });

  await logAuditEvent({
    workspaceId,
    action: "QUOTE_PAYMENT_DELETED",
    entityType: "Quote",
    entityId: id,
    summary: `Eliminó un abono de la proforma ${id}. Nuevo acumulado pagado: ${newPaid}`,
  });

  return NextResponse.json({ ok: true, paidAmount: newPaid });
}
