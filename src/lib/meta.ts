import crypto from "crypto";
import { getIntegrationSettings } from "./prisma";
import { normalizeCRPhone } from "./format";

export interface SendWhatsAppInput {
  to: string;
  text: string;
  imageUrl?: string;
  documentUrl?: string;
  documentFilename?: string;
  workspaceId?: string;
}

export function buildWhatsAppDesktopLinks(phone: string, text: string) {
  const normalized = normalizeCRPhone(phone);
  const encoded = encodeURIComponent(text);
  return {
    phone: normalized,
    webLink: normalized ? `https://wa.me/${normalized}?text=${encoded}` : "",
    appLink: normalized ? `whatsapp://send?phone=${normalized}&text=${encoded}` : "",
  };
}

export async function sendWhatsAppCloudMessage(input: SendWhatsAppInput) {
  const cfg = await getIntegrationSettings(input.workspaceId);
  const to = normalizeCRPhone(input.to);

  if (!to) {
    return { ok: false, simulated: true, error: "Número de WhatsApp inválido." };
  }

  if (!cfg.metaAccessToken || !cfg.metaPhoneNumberId) {
    return {
      ok: true,
      simulated: true,
      externalMessageId: `sim-wa-${Date.now()}`,
      info: "Meta Cloud API sin credenciales aún: mensaje registrado en modo simulador.",
    };
  }

  const endpoint = `https://graph.facebook.com/v21.0/${cfg.metaPhoneNumberId}/messages`;

  const payload = input.imageUrl
    ? {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "image",
        image: {
          link: input.imageUrl,
          caption: input.text.slice(0, 1020),
        },
      }
    : input.documentUrl
    ? {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "document",
        document: {
          link: input.documentUrl,
          caption: input.text,
          filename: input.documentFilename || "Proforma.pdf",
        },
      }
    : {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          preview_url: true,
          body: input.text,
        },
      };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.metaAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      simulated: false,
      error: data?.error?.message || `Error Meta Cloud API (${res.status})`,
    };
  }

  return {
    ok: true,
    simulated: false,
    externalMessageId: data?.messages?.[0]?.id || `wa-${Date.now()}`,
    info: "Mensaje enviado correctamente vía Meta WhatsApp Cloud API.",
  };
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!appSecret) return true; // Skip check if App Secret not configured yet
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function fetchMetaLeadDetails(leadgenId: string, accessToken: string) {
  if (!accessToken || !leadgenId) return null;
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${encodeURIComponent(accessToken)}`
  );
  if (!res.ok) return null;
  return res.json();
}
