// Edge-compatible Web Crypto HMAC-SHA256 session helper (Multi-Tenant SaaS)

export const SESSION_COOKIE = "impulsa_session";

export type SessionRole = "SUPERADMIN" | "OWNER" | "AGENT";

export interface AuthSession {
  userId: string;
  email: string;
  role: SessionRole;
}

export function getAuthConfig() {
  return {
    adminEmail: (process.env.CRM_ADMIN_EMAIL || "ventas@elcaminantecr.com").trim().toLowerCase(),
    adminPassword: process.env.CRM_ADMIN_PASSWORD || "Caminante2026!",
    secret: process.env.CRM_AUTH_SECRET || "impulsa-crm-local-secret-change-in-prod-2026",
  };
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(
  email: string,
  userId = "superadmin",
  role: SessionRole = "SUPERADMIN"
): Promise<string> {
  const { secret } = getAuthConfig();
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 14; // 14 days
  const cleanEmail = email.trim().toLowerCase();
  const payload = `${userId}|${cleanEmail}|${role}|${exp}`;
  const sig = await hmacSign(payload, secret);
  return `${payload}|${sig}`;
}

export async function verifySessionToken(token: string | undefined): Promise<AuthSession | null> {
  if (!token) return null;
  const parts = token.split("|");
  const { secret } = getAuthConfig();

  // New multi-tenant format: userId|email|role|exp|sig
  if (parts.length === 5) {
    const [userId, email, roleRaw, expStr, sig] = parts;
    const exp = Number(expStr);
    if (!userId || !email || !Number.isFinite(exp) || Date.now() > exp) return null;
    const role: SessionRole =
      roleRaw === "SUPERADMIN" ? "SUPERADMIN" : roleRaw === "AGENT" ? "AGENT" : "OWNER";
    const expected = await hmacSign(`${userId}|${email}|${role}|${expStr}`, secret);
    if (sig.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) {
      diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (diff !== 0) return null;
    return { userId, email, role };
  }

  // Legacy 3-part token compatibility: email|exp|sig (treated as SUPERADMIN)
  if (parts.length === 3) {
    const [email, expStr, sig] = parts;
    const exp = Number(expStr);
    if (!email || !Number.isFinite(exp) || Date.now() > exp) return null;
    const expected = await hmacSign(`${email}|${expStr}`, secret);
    if (sig.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) {
      diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (diff !== 0) return null;
    return { userId: "superadmin", email, role: "SUPERADMIN" };
  }

  return null;
}
