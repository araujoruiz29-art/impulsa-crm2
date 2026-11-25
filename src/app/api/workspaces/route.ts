import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId, getCurrentSession, WORKSPACE_COOKIE } from "@/lib/workspace";

export async function GET() {
  const session = await getCurrentSession();
  const activeId = await getActiveWorkspaceId();

  // Strict multi-tenant isolation: OWNER sees ONLY their own companies; SUPERADMIN sees all
  const companies = await prisma.companySettings.findMany({
    where:
      session && session.role !== "SUPERADMIN"
        ? { ownerUserId: session.userId }
        : undefined,
    orderBy: { createdAt: "asc" },
  });

  const workspaces = await Promise.all(
    companies.map(async (c) => {
      const [clientsCount, quotesCount] = await Promise.all([
        prisma.client.count({ where: { workspaceId: c.id } }),
        prisma.quote.count({ where: { workspaceId: c.id } }),
      ]);
      return {
        id: c.id,
        brandName: c.brandName,
        companyName: c.companyName,
        primaryColor: c.primaryColor,
        accentColor: c.accentColor,
        logoPath: c.logoPath,
        defaultCurrency: c.defaultCurrency,
        defaultTaxMode: c.defaultTaxMode,
        defaultSeller: c.defaultSeller,
        clientsCount,
        quotesCount,
      };
    })
  );

  const resolvedActive = workspaces.some((w) => w.id === activeId)
    ? activeId
    : workspaces[0]?.id || "default";

  return NextResponse.json({
    activeWorkspaceId: resolvedActive,
    role: session?.role || "SUPERADMIN",
    userEmail: session?.email || "",
    workspaces,
  });
}

// Create a brand new company workspace owned by the logged-in user
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    const ownerUserId = session?.role === "SUPERADMIN" || !session ? "superadmin" : session.userId;

    const body = await req.json();
    const brandName = String(body.brandName || "").trim();
    if (!brandName) {
      return NextResponse.json({ error: "El nombre de la empresa es obligatorio." }, { status: 400 });
    }

    const slug =
      "ws_" +
      brandName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 24) +
      "_" +
      Date.now().toString().slice(-4);

    const primaryColor = String(body.primaryColor || "#1E1046");
    const accentColor = String(body.accentColor || "#0070C0");
    const defaultCurrency = String(body.defaultCurrency || "CRC");
    const defaultTaxRate = body.defaultTaxRate !== undefined ? Number(body.defaultTaxRate) : 0.13;
    const defaultTaxMode = String(body.defaultTaxMode || "IVA_INCLUIDO");
    const defaultSeller = String(body.defaultSeller || "Administrador");

    const company = await prisma.companySettings.create({
      data: {
        id: slug,
        ownerUserId,
        brandName,
        companyName: String(body.companyName || brandName),
        primaryColor,
        accentColor,
        legalId: String(body.legalId || ""),
        address: String(body.address || ""),
        phone: String(body.phone || ""),
        whatsapp: String(body.whatsapp || ""),
        sinpePhone: String(body.sinpePhone || ""),
        email: String(body.email || session?.email || ""),
        secondaryEmail: String(body.secondaryEmail || ""),
        billingEmail: String(body.billingEmail || ""),
        defaultSeller,
        defaultCurrency,
        defaultTaxRate,
        defaultTaxMode,
        nextQuoteNumber: Number(body.nextQuoteNumber) || 1001,
        footerMotto: String(body.footerMotto || `Gracias por preferir a ${brandName}`),
        logoPath: String(body.logoPath || ""),
        bankAccountsJson: "[]",
      },
    });

    await prisma.integrationSettings.create({
      data: {
        id: slug,
        smtpFromName: brandName,
        smtpFromEmail: String(body.email || session?.email || ""),
        metaVerifyToken: `${slug}_verify`,
        aiSystemPrompt: `Eres el asistente comercial de ${brandName}. Responde con amabilidad, califica al cliente preguntando qué busca, cantidad y presupuesto, y pasa al vendedor cuando esté listo para comprar.`,
        aiKnowledgeBase: `Empresa: ${brandName}\nMoneda: ${defaultCurrency}\nImpuesto: ${Math.round(defaultTaxRate * 100)}% (${defaultTaxMode})`,
      },
    });

    await prisma.automationRule.create({
      data: {
        workspaceId: slug,
        name: "Respuesta inteligente de IA en WhatsApp",
        description:
          "Responde consultas nuevas, califica el interés y avisa al vendedor cuando el cliente está listo para comprar.",
        trigger: "NEW_WHATSAPP_MESSAGE",
        channel: "WHATSAPP",
        delayHours: 0,
        actionType: "AI_REPLY",
        active: true,
      },
    });

    const res = NextResponse.json({ workspace: company }, { status: 201 });
    res.cookies.set(WORKSPACE_COOKIE, slug, {
      httpOnly: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch (err) {
    console.error("Create workspace error:", err);
    return NextResponse.json({ error: "No se pudo crear la empresa." }, { status: 500 });
  }
}

// Switch active workspace (strictly verified for ownership)
export async function PATCH(req: NextRequest) {
  const session = await getCurrentSession();
  const body = await req.json();
  const workspaceId = String(body.workspaceId || "default");
  const exists = await prisma.companySettings.findUnique({ where: { id: workspaceId } });
  if (!exists) {
    return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
  }
  if (session && session.role !== "SUPERADMIN" && exists.ownerUserId !== session.userId) {
    return NextResponse.json({ error: "No tienes acceso a esta empresa." }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true, activeWorkspaceId: workspaceId });
  res.cookies.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
