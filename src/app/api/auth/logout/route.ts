import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { WORKSPACE_COOKIE } from "@/lib/workspace";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(WORKSPACE_COOKIE, "", {
    httpOnly: false,
    path: "/",
    maxAge: 0,
  });
  return res;
}
