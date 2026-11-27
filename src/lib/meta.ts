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
  const effectiveSecret = (appSecret || process.env.META_APP_SECRET || "").trim();
  if (!effectiveSecret) return true; // Skip only if App Secret is not configured in workspace or env
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", effectiveSecret).update(rawBody, "utf8").digest("hex");
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

// Auto-reply publicly to a Facebook or Instagram comment + optionally send Private Reply DM (official Meta Graph API)
export async function replyToMetaComment(opts: {
  commentId: string;
  channel: "FACEBOOK" | "INSTAGRAM";
  publicReplyText: string;
  privateDmText?: string;
  workspaceId?: string;
}) {
  const cfg = await getIntegrationSettings(opts.workspaceId);
  const token = (cfg.metaPageAccessToken || cfg.metaAccessToken || "").trim();
  if (!token || !opts.commentId) {
    return { ok: false, publicReplied: false, privateReplied: false };
  }

  let publicReplied = false;
  let privateReplied = false;

  // 1. Public comment reply
  try {
    const endpoint =
      opts.channel === "INSTAGRAM"
        ? `https://graph.facebook.com/v21.0/${encodeURIComponent(opts.commentId)}/replies`
        : `https://graph.facebook.com/v21.0/${encodeURIComponent(opts.commentId)}/comments`;
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: opts.publicReplyText.slice(0, 500) }),
    });
    publicReplied = r.ok;
  } catch {
    publicReplied = false;
  }

  // 2. Private DM reply directly to the commenter (official Meta Private Replies API)
  if (opts.privateDmText) {
    try {
      const targetNode =
        opts.channel === "INSTAGRAM"
          ? (cfg.metaIgAccountId || cfg.metaPageId || "me").trim()
          : (cfg.metaPageId || "me").trim();
      const r2 = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(targetNode)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: { comment_id: opts.commentId },
            message: { text: opts.privateDmText.slice(0, 990) },
          }),
        }
      );
      privateReplied = r2.ok;
    } catch {
      privateReplied = false;
    }
  }

  return { ok: publicReplied || privateReplied, publicReplied, privateReplied };
}

// #6: Official WhatsApp Cloud API Interactive Reply Buttons (up to 3 clickable buttons!)
export async function sendWhatsAppInteractiveButtons(opts: {
  workspaceId?: string;
  to: string;
  bodyText: string;
  buttons: Array<{ id: string; title: string }>;
  footerText?: string;
}): Promise<{
  ok: boolean;
  simulated: boolean;
  externalMessageId?: string;
  info?: string;
  error?: string;
}> {
  const cfg = await getIntegrationSettings(opts.workspaceId);
  const to = normalizeCRPhone(opts.to);
  if (!to) return { ok: false, simulated: true, error: "Número de WhatsApp inválido." };

  const cleanButtons = opts.buttons
    .slice(0, 3)
    .map((b, i) => ({
      type: "reply",
      reply: {
        id: (b.id || `btn_${i + 1}`).slice(0, 250),
        title: (b.title || `Opción ${i + 1}`).slice(0, 20),
      },
    }));

  if (cleanButtons.length === 0) {
    return sendWhatsAppCloudMessage({ workspaceId: opts.workspaceId, to, text: opts.bodyText });
  }

  if (!cfg.metaAccessToken || !cfg.metaPhoneNumberId) {
    return {
      ok: true,
      simulated: true,
      externalMessageId: `sim-wa-btn-${Date.now()}`,
      info: "Modo simulador: mensaje con botones interactivos guardado localmente.",
    };
  }

  const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.metaPhoneNumberId)}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: opts.bodyText.slice(0, 1024) },
      ...(opts.footerText ? { footer: { text: opts.footerText.slice(0, 60) } } : {}),
      action: { buttons: cleanButtons },
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
    return { ok: false, simulated: false, error: data?.error?.message || `Error Meta Interactive (${res.status})` };
  }
  return {
    ok: true,
    simulated: false,
    externalMessageId: data?.messages?.[0]?.id || `wa-btn-${Date.now()}`,
    info: "Mensaje con botones interactivos enviado vía WhatsApp Cloud API.",
  };
}

function pcm24kToWavBuffer(pcm: Buffer): Buffer {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// #10: Optional AI Outbound Voice Note Reply via Gemini TTS + Meta Media Upload (falls back to text if unavailable)
export async function sendWhatsAppAudioNote(opts: {
  workspaceId?: string;
  to: string;
  text: string;
  voiceName?: string;
}): Promise<{
  ok: boolean;
  simulated?: boolean;
  fallbackText?: boolean;
  externalMessageId?: string;
  info?: string;
  error?: string;
}> {
  const cfg = await getIntegrationSettings(opts.workspaceId);
  const to = normalizeCRPhone(opts.to);
  if (!to || !cfg.aiApiKey || !cfg.metaAccessToken || !cfg.metaPhoneNumberId) {
    return { ok: false, fallbackText: true, error: "Audio IA requiere Gemini API + Meta Cloud API." };
  }

  try {
    const voice = (opts.voiceName || cfg.aiVoiceName || "Aoede").trim();
    const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(
      cfg.aiApiKey
    )}`;
    const ttsRes = await fetch(ttsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Habla como asesor comercial amable y natural en español latinoamericano. Lee esto breve y claro:\n\n${opts.text.slice(0, 480)}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });
    if (!ttsRes.ok) {
      return { ok: false, fallbackText: true, error: `Gemini TTS HTTP ${ttsRes.status}` };
    }
    const ttsData = await ttsRes.json().catch(() => ({}));
    const b64 = ttsData?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) return { ok: false, fallbackText: true, error: "Audio vacío" };

    const wavBuf = pcm24kToWavBuffer(Buffer.from(b64, "base64"));
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("file", new Blob([new Uint8Array(wavBuf)], { type: "audio/wav" }), "respuesta-ia.wav");

    const uploadRes = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.metaPhoneNumberId)}/media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.metaAccessToken}` },
        body: form,
      }
    );
    const uploadData = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok || !uploadData.id) {
      return { ok: false, fallbackText: true, error: uploadData?.error?.message || "No se pudo subir audio a Meta." };
    }

    const sendRes = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.metaPhoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.metaAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "audio",
          audio: { id: String(uploadData.id) },
        }),
      }
    );
    const sendData = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok) {
      return { ok: false, fallbackText: true, error: sendData?.error?.message || "Error enviando audio." };
    }
    return {
      ok: true,
      simulated: false,
      externalMessageId: sendData?.messages?.[0]?.id || `wa-audio-${Date.now()}`,
      info: "🎙️ Nota de voz IA enviada vía WhatsApp Cloud API.",
    };
  } catch (err) {
    return { ok: false, fallbackText: true, error: err instanceof Error ? err.message : "Error audio IA" };
  }
}

// VoIP Oficial WhatsApp Business Calling API (WebRTC):
// 1. Enable/disable the official Call icon & callback permissions on the business WhatsApp number
export async function configureWhatsAppCallingSettings(opts: {
  workspaceId?: string;
  enabled: boolean;
}): Promise<{ ok: boolean; info?: string; error?: string }> {
  const cfg = await getIntegrationSettings(opts.workspaceId);
  if (!cfg.metaAccessToken || !cfg.metaPhoneNumberId) {
    return {
      ok: false,
      error: "Conecta primero tu Token Permanente y Phone Number ID de WhatsApp Cloud API.",
    };
  }
  try {
    const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.metaPhoneNumberId)}/settings`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.metaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        calling: {
          status: opts.enabled ? "ENABLED" : "DISABLED",
          call_icon_visibility: opts.enabled ? "DEFAULT" : "DISABLE_ALL",
          callback_permission_status: opts.enabled ? "ENABLED" : "DISABLED",
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error:
          data?.error?.message ||
          `Meta respondió HTTP ${res.status}. Verifica que tu WABA tenga Calling API habilitado.`,
      };
    }
    return {
      ok: true,
      info: opts.enabled
        ? "✅ Llamadas VoIP activadas en tu número de WhatsApp Business (ícono 📞 visible y llamadas entrantes gratis)."
        : "🔕 Llamadas VoIP desactivadas en tu número de WhatsApp Business.",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error configurando Calling API." };
  }
}

// 2. Send official interactive Call Permission Request inside an active 24h WhatsApp window
export async function sendWhatsAppCallPermissionRequest(opts: {
  workspaceId?: string;
  to: string;
  bodyText?: string;
}): Promise<{ ok: boolean; externalMessageId?: string; info?: string; error?: string }> {
  const cfg = await getIntegrationSettings(opts.workspaceId);
  const to = normalizeCRPhone(opts.to);
  if (!to) return { ok: false, error: "Número de WhatsApp inválido." };
  if (!cfg.metaAccessToken || !cfg.metaPhoneNumberId) {
    return { ok: false, error: "Conecta primero Meta Cloud API en Conexiones y empresa." };
  }
  try {
    const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.metaPhoneNumberId)}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "call_permission_request",
        action: { name: "call_permission_request" },
        body: {
          text: (
            opts.bodyText ||
            "¿Nos autorizas a llamarte por WhatsApp para asesorarte más rápido sobre tu solicitud?"
          ).slice(0, 1024),
        },
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
        error: data?.error?.message || `Meta rechazó la solicitud de permiso (HTTP ${res.status}).`,
      };
    }
    return {
      ok: true,
      externalMessageId: data?.messages?.[0]?.id || `wa-callperm-${Date.now()}`,
      info: "📲 Solicitud de permiso de llamada enviada por WhatsApp. En cuanto el cliente acepte podrás llamarlo.",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error enviando permiso de llamada." };
  }
}

// 3. Control live WhatsApp WebRTC Call signaling (connect, pre_accept, accept, reject, terminate)
export async function controlWhatsAppCall(opts: {
  workspaceId?: string;
  action: "connect" | "pre_accept" | "accept" | "reject" | "terminate";
  callId?: string;
  to?: string;
  sdp?: string;
  sdpType?: "offer" | "answer";
}): Promise<{ ok: boolean; callId?: string; info?: string; error?: string }> {
  const cfg = await getIntegrationSettings(opts.workspaceId);
  if (!cfg.metaAccessToken || !cfg.metaPhoneNumberId) {
    return { ok: false, error: "Conecta primero Meta Cloud API en Conexiones y empresa." };
  }
  try {
    const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.metaPhoneNumberId)}/calls`;
    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      action: opts.action,
    };
    if (opts.action === "connect") {
      const to = normalizeCRPhone(opts.to || "");
      if (!to) return { ok: false, error: "Número de destino inválido." };
      payload.to = to;
    } else if (opts.callId) {
      payload.call_id = opts.callId;
    }
    if (opts.sdp && opts.sdpType) {
      payload.session = {
        sdp_type: opts.sdpType,
        sdp: opts.sdp,
      };
    }

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
        error: data?.error?.message || `Meta Calling API (${opts.action}) devolvió HTTP ${res.status}.`,
      };
    }
    const returnedCallId = String(data?.calls?.[0]?.id || opts.callId || "");
    return { ok: true, callId: returnedCallId, info: `Acción VoIP "${opts.action}" ejecutada.` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de señalización VoIP." };
  }
}
