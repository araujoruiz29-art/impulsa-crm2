import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getAuthConfig, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const cfg = getAuthConfig();

    if (email !== cfg.adminEmail || password !== cfg.adminPassword) {
      return NextResponse.json(
        { error: "Correo o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const token = await createSessionToken(email);
    const res = NextResponse.json({ ok: true, email });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && !req.url.includes("localhost") && !req.url.includes("127.0.0.1"),
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Error iniciando sesión." }, { status: 500 });
  }
}
