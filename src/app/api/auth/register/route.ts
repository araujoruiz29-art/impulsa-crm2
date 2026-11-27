import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getAuthConfig, SESSION_COOKIE } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { WORKSPACE_COOKIE } from "@/lib/workspace";
import { checkRateLimit, getClientIp } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Límite de registros alcanzado temporalmente. Intenta más tarde." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const brandName = String(body.brandName || "").trim();
    const companyName = String(body.companyName || brandName).trim();
    const defaultCurrency = String(body.defaultCurrency || "CRC") === "USD" ? "USD" : "CRC";
    const defaultTaxMode = ["IVA_INCLUIDO", "DESGLOSADO", "EXONERADO"].includes(String(body.defaultTaxMode))
      ? String(body.defaultTaxMode)
      : "IVA_INCLUIDO";
    const primaryColor = String(body.primaryColor || "#22115d");

    if (!brandName) {
      return NextResponse.json({ error: "Escribe el nombre comercial de tu empresa." }, { status: 400 });
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Ingresa un correo electrónico válido." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }

    const cfg = getAuthConfig();
    if (email === cfg.adminEmail) {
      return NextResponse.json(
        { error: "Ese correo ya está registrado. Inicia sesión con tu contraseña." },
        { status: 409 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una cuenta registrada con ese correo. Inicia sesión." },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: name || brandName,
        passwordHash: hashPassword(password),
        role: "OWNER",
      },
    });

    const slug =
      "ws_" +
      brandName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 22) +
      "_" +
      Date.now().toString().slice(-5);

    const sellerName = name || "Administrador";

    await prisma.companySettings.create({
      data: {
        id: slug,
        ownerUserId: user.id,
        brandName,
        companyName,
        primaryColor,
        accentColor: "#0070C0",
        legalId: "",
        address: "",
        phone: "",
        whatsapp: "",
        sinpePhone: "",
        email,
        secondaryEmail: "",
        billingEmail: email,
        defaultSeller: sellerName,
        defaultCurrency,
        defaultTaxRate: defaultTaxMode === "EXONERADO" ? 0 : 0.13,
        defaultTaxMode,
        nextQuoteNumber: 1001,
        footerMotto: `Gracias por preferir a ${brandName}`,
        logoPath: "",
        bankAccountsJson: "[]",
      },
    });

    await prisma.integrationSettings.create({
      data: {
        id: slug,
        smtpFromName: brandName,
        smtpFromEmail: email,
        metaVerifyToken: `${slug}_verify`,
        aiSystemPrompt: `Eres el asistente comercial oficial de ${brandName}. Responde con cordialidad, claridad y precisión usando la base de conocimiento de la empresa. Califica al cliente preguntando qué producto/servicio busca, cantidades y fecha, y avisa al vendedor cuando muestre intención de compra.`,
        aiKnowledgeBase: `Empresa: ${brandName}\nRazón social: ${companyName}\nMoneda: ${defaultCurrency}\nImpuesto: ${defaultTaxMode}`,
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

    const token = await createSessionToken(user.email, user.id, "OWNER");
    const isProd =
      process.env.NODE_ENV === "production" &&
      !req.url.includes("localhost") &&
      !req.url.includes("127.0.0.1");

    const res = NextResponse.json(
      { ok: true, email: user.email, workspaceId: slug, brandName },
      { status: 201 }
    );
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    res.cookies.set(WORKSPACE_COOKIE, slug, {
      httpOnly: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "No se pudo crear la cuenta. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
