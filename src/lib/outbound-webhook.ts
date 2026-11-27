import crypto from "node:crypto";
import { getIntegrationSettings } from "./prisma";
import { isSafeExternalHttpsUrl } from "./security";

export type OutboundEventType =
  | "CLIENT_CREATED"
  | "STAGE_CHANGED"
  | "QUOTE_APPROVED"
  | "PAYMENT_RECEIVED"
  | "BOOKING_CREATED"
  | "INVOICE_EMITTED";

export async function emitOutboundWebhook(input: {
  workspaceId: string;
  event: OutboundEventType;
  payload: Record<string, unknown>;
}): Promise<{ ok: boolean; skipped?: boolean; status?: number; error?: string }> {
  try {
    const cfg = await getIntegrationSettings(input.workspaceId);
    const url = (cfg.outboundWebhookUrl || "").trim();
    if (!url || !isSafeExternalHttpsUrl(url)) {
      return { ok: true, skipped: true };
    }

    const enabledEvents = (cfg.outboundWebhookEvents || "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (enabledEvents.length > 0 && !enabledEvents.includes(input.event)) {
      return { ok: true, skipped: true };
    }

    const envelope = {
      app: "impulsa-crm",
      event: input.event,
      workspaceId: input.workspaceId,
      timestamp: new Date().toISOString(),
      data: input.payload,
    };
    const rawBody = JSON.stringify(envelope);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Impulsa-Event": input.event,
    };

    if (cfg.outboundWebhookSecret) {
      const sig = crypto
        .createHmac("sha256", cfg.outboundWebhookSecret)
        .update(rawBody, "utf8")
        .digest("hex");
      headers["X-Impulsa-Signature"] = `sha256=${sig}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: rawBody,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.warn("Outbound webhook delivery warning:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
