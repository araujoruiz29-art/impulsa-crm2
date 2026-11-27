import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateQuoteTotals } from "@/lib/format";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const workspaceId = await getActiveWorkspaceId();
  const { id } = await context.params;
  const quote = await prisma.quote.findFirst({
    where: { id, workspaceId },
    include: { items: { orderBy: { sortOrder: "asc" } }, client: true },
  });
  if (!quote) {
    return NextResponse.json({ error: "Proforma no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ quote });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const { id } = await context.params;
    const body = await req.json();
    const existing = await prisma.quote.findFirst({
      where: { id, workspaceId },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Proforma no encontrada." }, { status: 404 });
    }

    const taxMode = body.taxMode !== undefined ? String(body.taxMode) : existing.taxMode;
    const taxRate = body.taxRate !== undefined ? Number(body.taxRate) : existing.taxRate;
    const discountAmount =
      body.discountAmount !== undefined ? Number(body.discountAmount) : existing.discountAmount;

    let totals = {
      subtotal: existing.subtotal,
      discountAmount: existing.discountAmount,
      taxAmount: existing.taxAmount,
      total: existing.total,
    };

    if (Array.isArray(body.items)) {
      const normalized = body.items.map((it: Record<string, unknown>, idx: number) => {
        const quantity = Math.max(0.01, Number(it.quantity) || 1);
        const unitPrice = Math.max(0, Number(it.unitPrice) || 0);
        return {
          productId: it.productId ? String(it.productId) : null,
          sortOrder: idx,
          quantity,
          title: String(it.title || "Artículo").trim(),
          description: String(it.description || "").trim(),
          unitPrice,
          lineTotal: Number((quantity * unitPrice).toFixed(2)),
        };
      });
      totals = calculateQuoteTotals(normalized, taxMode, taxRate, discountAmount);

      await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
      await prisma.quoteItem.createMany({
        data: normalized.map((n: Record<string, unknown>) => ({ ...n, quoteId: id })) as never,
      });
    } else if (body.taxMode !== undefined || body.discountAmount !== undefined) {
      totals = calculateQuoteTotals(existing.items, taxMode, taxRate, discountAmount);
    }

    const quote = await prisma.quote.update({
      where: { id },
      data: {
        ...(body.clientId !== undefined ? { clientId: body.clientId || null } : {}),
        ...(body.clientCode !== undefined ? { clientCode: String(body.clientCode) } : {}),
        ...(body.clientCompany !== undefined ? { clientCompany: String(body.clientCompany) } : {}),
        ...(body.clientContact !== undefined ? { clientContact: String(body.clientContact) } : {}),
        ...(body.clientAddress !== undefined ? { clientAddress: String(body.clientAddress) } : {}),
        ...(body.clientPhone !== undefined ? { clientPhone: String(body.clientPhone) } : {}),
        ...(body.clientEmail !== undefined ? { clientEmail: String(body.clientEmail) } : {}),
        ...(body.seller !== undefined ? { seller: String(body.seller) } : {}),
        ...(body.jobTitle !== undefined ? { jobTitle: String(body.jobTitle) } : {}),
        ...(body.paymentTerms !== undefined ? { paymentTerms: String(body.paymentTerms) } : {}),
        ...(body.validity !== undefined ? { validity: String(body.validity) } : {}),
        ...(body.currency !== undefined ? { currency: String(body.currency) } : {}),
        ...(body.status !== undefined ? { status: String(body.status) } : {}),
        ...(body.notes !== undefined ? { notes: String(body.notes) } : {}),
        taxMode,
        taxRate,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        total: totals.total,
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    if (body.status === "APROBADA" && quote.clientId) {
      await prisma.client.updateMany({
        where: { id: quote.clientId, workspaceId },
        data: { stage: "GANADO", estimatedValue: quote.total },
      });
    }

    return NextResponse.json({ quote });
  } catch (err) {
    console.error("Update quote error:", err);
    return NextResponse.json({ error: "Error actualizando proforma." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const workspaceId = await getActiveWorkspaceId();
  const { id } = await context.params;
  const deleted = await prisma.quote.deleteMany({ where: { id, workspaceId } });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Proforma no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
