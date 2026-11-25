import { NextRequest, NextResponse } from "next/server";
import { getIntegrationSettings } from "@/lib/prisma";
import { normalizeCRPhone } from "@/lib/format";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "verify";
    const cfg = await getIntegrationSettings();

    if (!cfg.metaAccessToken || !cfg.metaPhoneNumberId) {
      return NextResponse.json(
        { ok: false, error: "Primero pega tu Token de Acceso y tu WhatsApp Phone Number ID y guarda." },
        { status: 400 }
      );
    }

    // 1. Verify Phone Number ID & Token with Meta Graph API
    if (action === "verify") {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(
          cfg.metaPhoneNumberId
        )}?fields=display_phone_number,verified_name,quality_rating`,
        {
          headers: { Authorization: `Bearer ${cfg.metaAccessToken}` },
          cache: "no-store",
        }
      );
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: data?.error?.message || `Error Meta API (${res.status})` },
          { status: 400 }
        );
      }
      return NextResponse.json({
        ok: true,
        message: `Conexión Meta exitosa: ${data.verified_name || "WhatsApp Business"} (${
          data.display_phone_number || cfg.metaPhoneNumberId
        }) · Calidad: ${data.quality_rating || "OK"}`,
        details: data,
      });
    }

    // 2. Send real test WhatsApp message (uses hello_world template or free text)
    if (action === "send_test") {
      const to = normalizeCRPhone(String(body.to || ""));
      if (!to) {
        return NextResponse.json(
          { ok: false, error: "Ingresa un número destino válido (ej. 8449-1975 o 50684491975)." },
          { status: 400 }
        );
      }

      const useTemplate = body.mode !== "text";
      const payload = useTemplate
        ? {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: { name: "hello_world", language: { code: "en_US" } },
          }
        : {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to,
            type: "text",
            text: {
              body: "¡Hola! Prueba exitosa desde Impulsa CRM conectado a Meta Cloud API ✅",
            },
          };

      const res = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.metaPhoneNumberId)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.metaAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: data?.error?.message || `Error enviando WhatsApp (${res.status})` },
          { status: 400 }
        );
      }
      return NextResponse.json({
        ok: true,
        message: `WhatsApp de prueba enviado a +${to} (ID: ${data?.messages?.[0]?.id || "OK"})`,
      });
    }

    return NextResponse.json({ ok: false, error: "Acción no soportada" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error conectando con Meta." },
      { status: 500 }
    );
  }
}
