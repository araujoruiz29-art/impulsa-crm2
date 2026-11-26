import { NextRequest, NextResponse } from "next/server";
import { getIntegrationSettings, prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { normalizeCRPhone } from "@/lib/format";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "verify";
    const workspaceId = await getActiveWorkspaceId();
    const cfg = await getIntegrationSettings(workspaceId);

    // 0. Verify Facebook Page + Instagram Business connection (Messenger & IG Direct)
    if (action === "verify_social") {
      const token = (cfg.metaPageAccessToken || cfg.metaAccessToken || "").trim();
      if (!token || (!cfg.metaPageId && !cfg.metaIgAccountId)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Primero pega tu Facebook Page ID (o Instagram Account ID) y el Token de Página (o Token Permanente) y guarda.",
          },
          { status: 400 }
        );
      }

      const parts: string[] = [];
      let discoveredIgId = cfg.metaIgAccountId || "";

      if (cfg.metaPageId) {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(
            cfg.metaPageId
          )}?fields=id,name,instagram_business_account{id,username,name}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return NextResponse.json(
            { ok: false, error: data?.error?.message || `Error Facebook Page API (${res.status})` },
            { status: 400 }
          );
        }
        parts.push(`Facebook Page: ${data.name || cfg.metaPageId} (ID ${data.id || cfg.metaPageId})`);
        if (data.instagram_business_account?.id) {
          discoveredIgId = String(data.instagram_business_account.id);
          const igLabel = data.instagram_business_account.username
            ? `@${data.instagram_business_account.username}`
            : discoveredIgId;
          parts.push(`Instagram vinculado: ${igLabel} (ID ${discoveredIgId})`);
          if (discoveredIgId !== cfg.metaIgAccountId) {
            await prisma.integrationSettings.update({
              where: { id: workspaceId },
              data: { metaIgAccountId: discoveredIgId },
            });
          }
        }
      } else if (cfg.metaIgAccountId) {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(
            cfg.metaIgAccountId
          )}?fields=id,username,name`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return NextResponse.json(
            { ok: false, error: data?.error?.message || `Error Instagram API (${res.status})` },
            { status: 400 }
          );
        }
        parts.push(
          `Instagram: ${data.username ? `@${data.username}` : data.name || cfg.metaIgAccountId}`
        );
      }

      return NextResponse.json({
        ok: true,
        message: `Conexión Social exitosa · ${parts.join(" · ")}`,
        metaIgAccountId: discoveredIgId,
      });
    }

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
