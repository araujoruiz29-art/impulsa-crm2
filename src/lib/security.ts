import crypto from "node:crypto";
import { getAuthConfig } from "./auth";

export const SECRET_MASK = "••••••••";

export function isMaskedOrEmpty(val: unknown): boolean {
  if (typeof val !== "string") return true;
  const trimmed = val.trim();
  return !trimmed || trimmed === SECRET_MASK || /^•+$/.test(trimmed);
}

export function maskSecret(val: string | null | undefined): string {
  return val && val.trim().length > 0 ? SECRET_MASK : "";
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still run constant-time dummy compare to avoid leaking timing on same-length prefix
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Lightweight in-memory sliding-window rate limiter (per serverless instance)
const rateStore = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = (rateStore.get(key) || []).filter((t) => t > cutoff);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateStore.set(key, timestamps);
    return { allowed: false, retryAfterSec };
  }

  timestamps.push(now);
  rateStore.set(key, timestamps);

  // Prevent unbounded memory growth
  if (rateStore.size > 2000) {
    for (const [k, list] of rateStore.entries()) {
      if (list.every((t) => t <= cutoff)) rateStore.delete(k);
    }
  }

  return { allowed: true, retryAfterSec: 0 };
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

// Anti-SSRF validator: only allow public https:// URLs (blocks loopback, RFC1918, link-local, metadata IPs)
export function isSafeExternalHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
      return false;
    }
    // Block IPv6 literals / loopback / ULA / link-local
    if (host.includes(":")) return false;
    // Block IPv4 private / loopback / link-local / metadata ranges
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
      if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127)
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Signed public download token for Proforma PDFs (used by WhatsApp Cloud API links)
export function signQuotePdfToken(quoteId: string): string {
  const { secret } = getAuthConfig();
  return crypto
    .createHmac("sha256", secret)
    .update(`quote-pdf:${quoteId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyQuotePdfToken(quoteId: string, token: string | null | undefined): boolean {
  if (!token || !quoteId) return false;
  const expected = signQuotePdfToken(quoteId);
  return timingSafeEqualStr(token.trim(), expected);
}
