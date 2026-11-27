import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { normalizeCRPhone } from "@/lib/format";
import { emitOutboundWebhook } from "@/lib/outbound-webhook";
import { pickNextRoundRobinAgent } from "@/lib/round-robin";

export async function GET(_req: NextRequest, context: { params: Promise<{ workspace: string }> }) {
  try {
    const { workspace } = await context.params;
    const company = await prisma.companySettings.findUnique({
      where: { id: workspace },
      select: {
        id: true,
        active: true,
        publicStoreEnabled: true,
        brandName: true,
        companyName: true,
        primaryColor: true,
        accentColor: true,
        logoPath: true,
        address: true,
        phone: true,
        whatsapp: true,
        sinpePhone: true,
        email: true,
        defaultCurrency: true,
        footerMotto: true,
      },
    });

    if (!company || !company.active || !company.publicStoreEnabled) {
      return NextResponse.json({ error: "Catálogo público no disponible." }, { status: 404 });
    }

    const products = await prisma.product.findMany({
      where: { workspaceId: company.id, active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
        description: true,
        unit: true,
        price: true,
        wholesaleMinQty: true,
        wholesalePrice: true,
        stock: true,
        imageUrl: true,
      },
    });

    return NextResponse.json({ company, products });
  } catch (err) {
    console.error("Public store GET error:", err);
    return NextResponse.json({ error: "Error cargando catálogo público." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ workspace: string }> }) {
  try {
    const { workspace } = await context.params;
    const ip = getClientIp(req);
    const rl = checkRateLimit(`pubstore:${ip}:${workspace}`, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Demasiadas solicitudes. Intenta en unos minutos." }, { status: 429 });
    }

    const company = await prisma.companySettings.findUnique({
      where: { id: workspace },
      select: { id: true, active: true, publicStoreEnabled: true, defaultSeller: true, brandName: true },
    });
    if (!company || !company.active || !company.publicStoreEnabled) {
      return NextResponse.json({ error: "Catálogo público no disponible." }, { status: 404 });
    }

    const body = await req.json();
    const customerName = String(body.name || "").trim();
    const customerPhone = normalizeCRPhone(String(body.phone || ""));
    const customerEmail = String(body.email || "").trim();
    const itemsSummary = String(body.itemsSummary || "").trim();
    const estimatedTotal = Math.max(0, Number(body.estimatedTotal) || 0);
    const notes = String(body.notes || "").trim();

    if (!customerName || (!customerPhone && !customerEmail)) {
      return NextResponse.json(
        { error: "Escribe tu nombre y tu WhatsApp o correo para enviarte la cotización." },
        { status: 400 }
      );
    }

    const rr = await pickNextRoundRobinAgent(company.id);
    const assignedTo = rr?.agentName || company.defaultSeller || "Asesor";

    const client = await prisma.client.create({
      data: {
        workspaceId: company.id,
        company: customerName,
        contactName: customerName,
        phone: customerPhone,
        whatsapp: customerPhone,
        email: customerEmail,
        stage: "NUEVO",
        source: "CATALOGO_WEB",
        tags: "catalogo-web,compra-real",
        estimatedValue: estimatedTotal,
        qualificationScore: 85,
        qualificationStatus: "LISTO_PARA_COMPRAR",
        assignedTo,
        notes: `Pedido desde Mini-Catálogo Web:\n${itemsSummary}${notes ? `\nNotas: ${notes}` : ""}`,
      },
    });

    await prisma.sellerAlert.create({
      data: {
        workspaceId: company.id,
        clientId: client.id,
        title: `🛒 Nuevo pedido desde Catálogo Web (${customerName})`,
        buyingSignals: `${itemsSummary}${notes ? ` · ${notes}` : ""}`.slice(0, 400),
        suggestedNextStep: `Escribirle a ${customerPhone || customerEmail} y enviarle su Proforma PDF.`,
        score: 92,
        priority: "ALTA",
      },
    });

    emitOutboundWebhook({
      workspaceId: company.id,
      event: "CLIENT_CREATED",
      payload: {
        clientId: client.id,
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        source: "CATALOGO_WEB",
        itemsSummary,
        estimatedTotal,
        assignedTo,
      },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      clientId: client.id,
      message: `✅ ¡Solicitud recibida! Un asesor de ${company.brandName} te contactará muy pronto.`,
    });
  } catch (err) {
    console.error("Public store POST error:", err);
    return NextResponse.json({ error: "Error enviando solicitud." }, { status: 500 });
  }
}
