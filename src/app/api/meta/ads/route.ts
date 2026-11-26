import { NextRequest, NextResponse } from "next/server";
import { getCompanySettings, getIntegrationSettings, prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { callGeminiResilient } from "@/lib/gemini";

interface MetaAdCampaign {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string;
  dailyBudget: number;
  lifetimeBudget: number;
  createdTime: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  leadsOrMessages: number;
}

function normalizeAdAccountId(raw: string): string {
  const clean = (raw || "").trim();
  if (!clean) return "";
  return clean.startsWith("act_") ? clean : `act_${clean}`;
}

// GET: Fetch live Meta Ads (Facebook & Instagram) campaigns + CRM attribution ROI
export async function GET() {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const [cfg, company, socialClients] = await Promise.all([
      getIntegrationSettings(workspaceId),
      getCompanySettings(workspaceId),
      prisma.client.findMany({
        where: {
          workspaceId,
          contactType: "CLIENTE",
          source: { in: ["META_ADS", "FACEBOOK", "INSTAGRAM"] },
        },
        select: {
          id: true,
          company: true,
          contactName: true,
          source: true,
          stage: true,
          estimatedValue: true,
          qualificationStatus: true,
          qualificationScore: true,
          metaCampaign: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const crmAttribution = {
      totalLeads: socialClients.length,
      metaAdsCount: socialClients.filter((c) => c.source === "META_ADS").length,
      facebookCount: socialClients.filter((c) => c.source === "FACEBOOK").length,
      instagramCount: socialClients.filter((c) => c.source === "INSTAGRAM").length,
      hotBuyersCount: socialClients.filter(
        (c) =>
          c.qualificationStatus === "LISTO_PARA_COMPRAR" ||
          c.qualificationStatus === "CALIENTE" ||
          (c.qualificationScore || 0) >= 50
      ).length,
      wonCount: socialClients.filter((c) => c.stage === "GANADO").length,
      pipelineValue: socialClients
        .filter((c) => c.stage !== "PERDIDO")
        .reduce((sum, c) => sum + (c.estimatedValue || 0), 0),
      wonValue: socialClients
        .filter((c) => c.stage === "GANADO")
        .reduce((sum, c) => sum + (c.estimatedValue || 0), 0),
      recentLeads: socialClients.slice(0, 8),
    };

    const adAccountId = normalizeAdAccountId(cfg.metaAdAccountId);
    const token = (cfg.metaAccessToken || cfg.metaPageAccessToken || "").trim();

    if (!adAccountId || !token) {
      return NextResponse.json({
        configured: false,
        adAccountId: adAccountId || "",
        currency: company.defaultCurrency || "CRC",
        warning:
          "Agrega tu Meta Ad Account ID (ej. act_123456789) y un Token con permisos ads_read / ads_management en Conexiones y empresa → Meta Cloud API para ver y pausar/activar tus anuncios de Facebook e Instagram aquí.",
        adCampaigns: [] as MetaAdCampaign[],
        crmAttribution,
      });
    }

    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(
      adAccountId
    )}/campaigns?fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget,created_time,insights.date_preset(last_30d){spend,impressions,reach,clicks,ctr,actions}&limit=30`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json({
        configured: true,
        adAccountId,
        currency: company.defaultCurrency || "CRC",
        warning:
          data?.error?.message ||
          `Meta Ads API respondió HTTP ${res.status}. Verifica que el token tenga permisos ads_read y ads_management.`,
        adCampaigns: [] as MetaAdCampaign[],
        crmAttribution,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adCampaigns: MetaAdCampaign[] = (Array.isArray(data.data) ? data.data : []).map((row: any) => {
      const ins = row.insights?.data?.[0] || {};
      const actions = Array.isArray(ins.actions) ? ins.actions : [];
      const leadAction = actions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((a: any) =>
          /lead|messaging_conversation_started|onsite_conversion\.messaging_first_reply/i.test(
            String(a.action_type || "")
          )
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .reduce((acc: number, a: any) => acc + Number(a.value || 0), 0);

      return {
        id: String(row.id || ""),
        name: String(row.name || "Campaña Meta"),
        status: String(row.status || "PAUSED"),
        effectiveStatus: String(row.effective_status || row.status || "PAUSED"),
        objective: String(row.objective || ""),
        // Meta returns budgets in minor currency units (cents)
        dailyBudget: row.daily_budget ? Number(row.daily_budget) / 100 : 0,
        lifetimeBudget: row.lifetime_budget ? Number(row.lifetime_budget) / 100 : 0,
        createdTime: String(row.created_time || ""),
        spend: Number(ins.spend || 0),
        impressions: Number(ins.impressions || 0),
        reach: Number(ins.reach || 0),
        clicks: Number(ins.clicks || 0),
        ctr: Number(ins.ctr || 0),
        leadsOrMessages: leadAction,
      };
    });

    return NextResponse.json({
      configured: true,
      adAccountId,
      currency: company.defaultCurrency || "CRC",
      adCampaigns,
      crmAttribution,
    });
  } catch (err) {
    console.error("Meta Ads GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error cargando campañas de Meta Ads." },
      { status: 500 }
    );
  }
}

// PATCH: Pause or Activate a live Facebook/Instagram Ad Campaign directly from impulsa CRM
export async function PATCH(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const cfg = await getIntegrationSettings(workspaceId);
    const token = (cfg.metaAccessToken || cfg.metaPageAccessToken || "").trim();
    const body = await req.json();
    const campaignId = String(body.campaignId || "").trim();
    const nextStatus = body.status === "ACTIVE" ? "ACTIVE" : "PAUSED";

    if (!token || !campaignId) {
      return NextResponse.json(
        { error: "Falta ID de campaña o token de Meta con permiso ads_management." },
        { status: 400 }
      );
    }

    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(campaignId)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "No se pudo cambiar el estado del anuncio. Verifica el permiso ads_management en tu token.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: nextStatus,
      message:
        nextStatus === "ACTIVE"
          ? "✅ Campaña de anuncios ACTIVADA en Facebook / Instagram."
          : "⏸️ Campaña de anuncios PAUSADA en Facebook / Instagram.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error actualizando anuncio en Meta." },
      { status: 500 }
    );
  }
}

// POST: AI Ad Copy Generator for Facebook & Instagram Ads (Click-to-WhatsApp / IG / Messenger)
export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const [cfg, company] = await Promise.all([
      getIntegrationSettings(workspaceId),
      getCompanySettings(workspaceId),
    ]);

    const body = await req.json();
    const productOrPromo = String(body.productOrPromo || "").trim();
    const objective = String(body.objective || "Mensajes a WhatsApp / Instagram").trim();
    const audience = String(body.audience || "Público general / empresas en Costa Rica").trim();

    if (!productOrPromo) {
      return NextResponse.json(
        { error: "Describe el producto, servicio o promoción que quieres anunciar." },
        { status: 400 }
      );
    }

    const fallbackIdeas = [
      {
        angle: "Directo al beneficio",
        headline: `${productOrPromo.slice(0, 42)} · Cotiza hoy`,
        primaryText: `¿Buscas ${productOrPromo}? En ${company.brandName} te atendemos de inmediato por WhatsApp o Instagram con respuesta rápida y cotización sin compromiso. 👇 Toca «Enviar mensaje» y te ayudamos ahora mismo.`,
        cta: "Enviar mensaje",
        targetingTip: `Intereses relacionados a ${audience}, radio local o país completo, ubicación automática en Reels + Feed de Facebook e Instagram.`,
      },
      {
        angle: "Urgencia y confianza",
        headline: `Atención rápida en ${company.brandName}`,
        primaryText: `Deja de perder tiempo esperando respuestas. Con ${company.brandName} cotizas ${productOrPromo} en minutos y con respaldo real. 📲 Escríbenos hoy mismo haciendo clic en el botón.`,
        cta: "Enviar mensaje por WhatsApp",
        targetingTip: `Crea un anuncio de objetivo «Interacción → Mensajes» hacia WhatsApp o Instagram Direct.`,
      },
      {
        angle: "Prueba social / Reels",
        headline: `Descubre ${productOrPromo.slice(0, 38)}`,
        primaryText: `Mira por qué nuestros clientes eligen ${company.brandName} para ${productOrPromo}. ✅ Calidad garantizada ✅ Atención personalizada. Escríbenos «INFO» por mensaje y te enviamos detalles al instante.`,
        cta: "Más información",
        targetingTip: `Ideal para formato video vertical 9:16 en Instagram Reels y Facebook Reels.`,
      },
    ];

    if (!cfg.aiApiKey) {
      return NextResponse.json({ ok: true, mode: "template", variations: fallbackIdeas });
    }

    try {
      const prompt = `Eres un experto en pauta publicitaria de Meta Ads (Facebook e Instagram) en Costa Rica y Latinoamérica.
Empresa: ${company.brandName} (${company.companyName})
Producto / Oferta a anunciar: ${productOrPromo}
Objetivo del anuncio: ${objective}
Público objetivo: ${audience}

Devuelve ÚNICAMENTE un JSON válido (sin markdown ni texto extra) con 3 variaciones listas para copiar y pegar en Meta Ads Manager:
{
  "variations": [
    {
      "angle": "Nombre corto del enfoque (ej. Dolor y solución / Oferta directa / Video Reel)",
      "headline": "Título llamativo de máximo 45 caracteres",
      "primaryText": "Texto principal persuasivo con emojis moderados y llamado a escribir por WhatsApp/IG/Messenger",
      "cta": "Botón recomendado (ej. Enviar mensaje por WhatsApp / Enviar mensaje / Más información)",
      "targetingTip": "Sugerencia concreta de segmentación y formato (Feed/Reels/Historias) en Meta Ads"
    }
  ]
}`;
      const { text } = await callGeminiResilient({
        apiKey: cfg.aiApiKey,
        preferredModel: cfg.aiModel,
        temperature: 0.65,
        maxOutputTokens: 900,
        parts: [{ text: prompt }],
      });
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (Array.isArray(parsed.variations) && parsed.variations.length > 0) {
          return NextResponse.json({ ok: true, mode: "gemini", variations: parsed.variations.slice(0, 3) });
        }
      }
    } catch (e) {
      console.error("Ad copy Gemini fallback:", e);
    }

    return NextResponse.json({ ok: true, mode: "template", variations: fallbackIdeas });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error generando textos de anuncio." },
      { status: 500 }
    );
  }
}
