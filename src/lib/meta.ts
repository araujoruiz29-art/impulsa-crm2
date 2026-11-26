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

export interface SendMetaSocialInput {
  channel: "FACEBOOK" | "INSTAGRAM";
  recipientId: string;
  text: string;
  workspaceId?: string;
}

export async function sendMetaSocialMessage(input: SendMetaSocialInput) {
  const cfg = await getIntegrationSettings(input.workspaceId);
  const recipientId = String(input.recipientId || "").trim();
  const token = (cfg.metaPageAccessToken || cfg.metaAccessToken || "").trim();

  if (!recipientId) {
    return { ok: false, simulated: true, error: "ID de destinatario inválido." };
  }

  const targetNodeId =
    input.channel === "INSTAGRAM"
      ? (cfg.metaIgAccountId || cfg.metaPageId || "").trim()
      : (cfg.metaPageId || "").trim();

  if (!token || !targetNodeId) {
    return {
      ok: true,
      simulated: true,
      externalMessageId: `sim-${input.channel.toLowerCase()}-${Date.now()}`,
      info: `Falta configurar Token de Página y ${
        input.channel === "INSTAGRAM" ? "Instagram Account ID / Page ID" : "Facebook Page ID"
      }: guardado en modo simulador.`,
    };
  }

  const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(targetNodeId)}/messages`;
  const payload =
    input.channel === "FACEBOOK"
      ? {
          messaging_type: "RESPONSE",
          recipient: { id: recipientId },
          message: { text: input.text.slice(0, 1950) },
        }
      : {
          recipient: { id: recipientId },
          message: { text: input.text.slice(0, 990) },
        };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      simulated: false,
      error: data?.error?.message || `Error Meta ${input.channel} API (${res.status})`,
    };
  }

  return {
    ok: true,
    simulated: false,
    externalMessageId: data?.message_id || `${input.channel.toLowerCase()}-${Date.now()}`,
    info: `Mensaje enviado correctamente vía ${
      input.channel === "INSTAGRAM" ? "Instagram Direct API" : "Facebook Messenger API"
    }.`,
  };
}

export async function fetchMetaSocialProfile(
  senderId: string,
  channel: "FACEBOOK" | "INSTAGRAM",
  accessToken: string
): Promise<{ name: string; username?: string } | null> {
  if (!senderId || !accessToken) return null;
  try {
    const fields = channel === "INSTAGRAM" ? "name,username" : "name,first_name,last_name";
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(senderId)}?fields=${fields}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const fullName =
      String(data.name || "").trim() ||
      [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
      (data.username ? `@${data.username}` : "");
    if (!fullName) return null;
    return {
      name: fullName,
      username: data.username ? String(data.username) : undefined,
    };
  } catch {
    return null;
  }
}
