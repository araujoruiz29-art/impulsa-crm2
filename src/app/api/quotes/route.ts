import { NextRequest, NextResponse } from "next/server";
import { getCompanySettings, prisma } from "@/lib/prisma";
import { calculateQuoteTotals, formatMoney } from "@/lib/format";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { signQuotePdfToken } from "@/lib/security";

export async function GET(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") || "").trim();
  const q = (searchParams.get("q") || "").trim();

  const quotes = await prisma.quote.findMany({
    where: {
      workspaceId,
      ...(status && status !== "ALL" ? { status } : {}),
      ...(q
        ? {
            OR: [
              { clientCompany: { contains: q } },
              { clientContact: { contains: q } },
              { jobTitle: { contains: q } },
              ...(Number.isFinite(Number(q)) ? [{ number: Number(q) }] : []),
            ],
          }
        : {}),
    },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      client: true,
    },
    orderBy: { number: "desc" },
  });

  return NextResponse.json({
    quotes: quotes.map((qt) => ({
      ...qt,
      portalPath: `/proforma/${qt.id}?sig=${signQuotePdfToken(qt.id)}`,
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const body = await req.json();
    const company = await getCompanySettings(workspaceId);

    const itemsInput = Array.isArray(body.items) ? body.items : [];
    if (itemsInput.length === 0) {
      return NextResponse.json({ error: "Agrega al menos una línea a la proforma." }, { status: 400 });
    }

    const taxMode = String(body.taxMode || company.defaultTaxMode || "IVA_INCLUIDO");
    const taxRate = body.taxRate !== undefined ? Number(body.taxRate) : company.defaultTaxRate;
    const discountAmount = Number(body.discountAmount) || 0;

    const normalizedItems = itemsInput.map((it: Record<string, unknown>, idx: number) => {
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

    const totals = calculateQuoteTotals(normalizedItems, taxMode, taxRate, discountAmount);

    // Consecutive proforma number per workspace
    const requestedNumber = body.number ? Number(body.number) : null;
    const latestQuote = await prisma.quote.findFirst({
      where: { workspaceId },
      orderBy: { number: "desc" },
    });
    const nextNum =
      requestedNumber ||
      Math.max(company.nextQuoteNumber, (latestQuote?.number || 1000) + 1);

    const quote = await prisma.quote.create({
      data: {
        workspaceId,
        number: nextNum,
        clientId: body.clientId ? String(body.clientId) : null,
        clientCode: String(body.clientCode || ""),
        clientCompany: String(body.clientCompany || "Cliente General"),
        clientContact: String(body.clientContact || ""),
        clientAddress: String(body.clientAddress || ""),
        clientPhone: String(body.clientPhone || ""),
        clientEmail: String(body.clientEmail || ""),
        seller: String(body.seller || company.defaultSeller),
        jobTitle: String(body.jobTitle || ""),
        paymentTerms: String(body.paymentTerms || company.defaultPaymentTerms),
        validity: String(body.validity || company.defaultValidity),
        currency: String(body.currency || company.defaultCurrency),
        taxMode,
        taxRate,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        total: totals.total,
        status: String(body.status || "BORRADOR"),
        notes: String(body.notes || ""),
        issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
        items: { create: normalizedItems },
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    await prisma.companySettings.update({
      where: { id: company.id },
      data: { nextQuoteNumber: Math.max(company.nextQuoteNumber, nextNum + 1) },
    });

    if (quote.clientId) {
      await prisma.client.update({
        where: { id: quote.clientId },
        data: { estimatedValue: quote.total },
      });
      await prisma.activity.create({
        data: {
          workspaceId,
          clientId: quote.clientId,
          quoteId: quote.id,
          type: "COTIZACION",
          title: `Factura Proforma #${quote.number} creada (${formatMoney(quote.total, quote.currency)})`,
          description: `${quote.jobTitle || "Proforma"} — ${quote.taxMode}`,
          completed: true,
        },
      });
    }

    return NextResponse.json({ quote }, { status: 201 });
  } catch (err) {
    console.error("Create quote error:", err);
    return NextResponse.json({ error: "No se pudo crear la proforma." }, { status: 500 });
  }
}
