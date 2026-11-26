import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getAuthConfig, SESSION_COOKIE, SessionRole } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { WORKSPACE_COOKIE } from "@/lib/workspace";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const cfg = getAuthConfig();

    const isProd =
      process.env.NODE_ENV === "production" &&
      !req.url.includes("localhost") &&
      !req.url.includes("127.0.0.1");

    // 1. Check SuperAdmin credentials (configured via Vercel env vars)
    if (email === cfg.adminEmail && password === cfg.adminPassword) {
      const token = await createSessionToken(email, "superadmin", "SUPERADMIN");
      const res = NextResponse.json({ ok: true, email, role: "SUPERADMIN" });
      res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        path: "/",
        maxAge: 60 * 60 * 24 * 14,
      });
      res.cookies.set(WORKSPACE_COOKIE, "default", {
        httpOnly: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
      return res;
    }

    // 2. Check registered SaaS company user (OWNER or AGENT) in database
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Correo o contraseña incorrectos." },
        { status: 401 }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        { error: "Tu usuario de vendedor está pausado. Contacta al administrador de tu empresa." },
        { status: 403 }
      );
    }

    const role: SessionRole =
      user.role === "SUPERADMIN" ? "SUPERADMIN" : user.role === "AGENT" ? "AGENT" : "OWNER";

    let targetWorkspace = null;
    if (role === "AGENT") {
      if (user.workspaceId) {
        targetWorkspace = await prisma.companySettings.findUnique({
          where: { id: user.workspaceId },
          select: { id: true, active: true, brandName: true, suspendedReason: true },
        });
      }
    } else if (role === "OWNER") {
      targetWorkspace = await prisma.companySettings.findFirst({
        where: { ownerUserId: user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, active: true, brandName: true, suspendedReason: true },
      });
    } else {
      targetWorkspace = await prisma.companySettings.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true, active: true, brandName: true, suspendedReason: true },
      });
    }

    if (role !== "SUPERADMIN" && targetWorkspace && !targetWorkspace.active) {
      return NextResponse.json(
        {
          error: `La cuenta de ${targetWorkspace.brandName} se encuentra temporalmente suspendida.${
            targetWorkspace.suspendedReason ? ` Motivo: ${targetWorkspace.suspendedReason}` : " Contacta a soporte de impulsa CRM."
          }`,
        },
        { status: 403 }
      );
    }

    const token = await createSessionToken(user.email, user.id, role);
    const res = NextResponse.json({
      ok: true,
      email: user.email,
      name: user.name,
      role,
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    if (targetWorkspace) {
      res.cookies.set(WORKSPACE_COOKIE, targetWorkspace.id, {
        httpOnly: false,
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Error iniciando sesión." }, { status: 500 });
  }
}
