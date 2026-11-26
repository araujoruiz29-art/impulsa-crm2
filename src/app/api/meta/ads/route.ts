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
  costPerResult: number;
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
          "Agrega tu Meta Ad Account ID (ej. act_808438614331546) y un Token con permisos ads_read y ads_management en Conexiones y empresa → Meta Cloud API para ver, crear y pausar/activar tus campañas de Facebook e Instagram aquí.",
        adCampaigns: [] as MetaAdCampaign[],
        crmAttribution,
      });
    }

    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(
      adAccountId
    )}/campaigns?fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget,created_time,insights.date_preset(last_30d){spend,impressions,reach,clicks,ctr,actions}&limit=40`;

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
          `Meta Ads API respondió HTTP ${res.status}. Verifica en Meta Business → Usuarios del sistema que el token tenga asignada tu cuenta publicitaria (${adAccountId}) con permisos ads_read y ads_management.`,
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
          /lead|messaging_conversation_started|onsite_conversion\.messaging_first_reply|landing_page_view|link_click/i.test(
            String(a.action_type || "")
          )
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .reduce((acc: number, a: any) => acc + Number(a.value || 0), 0);

      const spend = Number(ins.spend || 0);
      const costPerResult = leadAction > 0 ? spend / leadAction : 0;

      return {
        id: String(row.id || ""),
        name: String(row.name || "Campaña Meta"),
        status: String(row.status || "PAUSED"),
        effectiveStatus: String(row.effective_status || row.status || "PAUSED"),
        objective: String(row.objective || ""),
        dailyBudget: row.daily_budget ? Number(row.daily_budget) / 100 : 0,
        lifetimeBudget: row.lifetime_budget ? Number(row.lifetime_budget) / 100 : 0,
        createdTime: String(row.created_time || ""),
        spend,
        impressions: Number(ins.impressions || 0),
        reach: Number(ins.reach || 0),
        clicks: Number(ins.clicks || 0),
        ctr: Number(ins.ctr || 0),
        leadsOrMessages: leadAction,
        costPerResult,
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

// POST:
//   action === "create_campaign" -> Creates a real Campaign + AdSet directly in Meta Ads (PAUSED for safe review)
//   action === "video_script"    -> Generates complete In-Store Reel Script (shots, voice, overlays, caption, keyword)
//   default                      -> Generates 3 Ad Copy variations
export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const [cfg, company, docs] = await Promise.all([
      getIntegrationSettings(workspaceId),
      getCompanySettings(workspaceId),
      prisma.knowledgeDocument.findMany({
        where: { workspaceId, active: true },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
    ]);

    const body = await req.json();
    const action = String(body.action || "ad_copy");

    // 1. DIRECT CAMPAIGN + ADSET LAUNCHER IN META ADS
    if (action === "create_campaign") {
      const adAccountId = normalizeAdAccountId(cfg.metaAdAccountId);
      const token = (cfg.metaAccessToken || cfg.metaPageAccessToken || "").trim();
      if (!adAccountId || !token) {
        return NextResponse.json(
          {
            error:
              "Primero guarda tu Meta Ad Account ID (ej. act_808438614331546) y tu Token con permiso ads_management en Conexiones y empresa → Meta Cloud API.",
          },
          { status: 400 }
        );
      }

      const name = String(body.name || "").trim();
      const objective = ["OUTCOME_ENGAGEMENT", "OUTCOME_TRAFFIC", "OUTCOME_LEADS"].includes(
        String(body.objective)
      )
        ? String(body.objective)
        : "OUTCOME_ENGAGEMENT";
      const dailyBudget = Math.max(500, Number(body.dailyBudget) || 3000);
      const zone = String(body.zone || "SAN_CARLOS");
      const ageMin = Math.max(18, Math.min(60, Number(body.ageMin) || 18));
      const ageMax = Math.max(ageMin, Math.min(65, Number(body.ageMax) || 55));

      if (!name) {
        return NextResponse.json({ error: "Escribe un nombre para la campaña." }, { status: 400 });
      }

      // Step A: Create Campaign (PAUSED for safe review)
      const campRes = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(adAccountId)}/campaigns`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            objective,
            status: "PAUSED",
            special_ad_categories: [],
          }),
        }
      );
      const campData = await campRes.json().catch(() => ({}));
      if (!campRes.ok || !campData.id) {
        return NextResponse.json(
          {
            error:
              campData?.error?.message ||
              `No se pudo crear la campaña en Meta Ads (HTTP ${campRes.status}). Verifica el permiso ads_management.`,
          },
          { status: 400 }
        );
      }

      // Step B: Create targeted Ad Set (San Carlos / La Fortuna / GAM / Costa Rica)
      let geoLocations: Record<string, unknown> = { countries: ["CR"] };
      if (zone === "SAN_CARLOS") {
        geoLocations = {
          custom_locations: [
            { latitude: 10.3238, longitude: -84.4271, radius: 28, distance_unit: "kilometer" }, // Ciudad Quesada
            { latitude: 10.4678, longitude: -84.6427, radius: 22, distance_unit: "kilometer" }, // La Fortuna
          ],
        };
      } else if (zone === "LA_FORTUNA") {
        geoLocations = {
          custom_locations: [
            { latitude: 10.4678, longitude: -84.6427, radius: 25, distance_unit: "kilometer" },
          ],
        };
      } else if (zone === "GAM") {
        geoLocations = {
          custom_locations: [
            { latitude: 9.9281, longitude: -84.0907, radius: 30, distance_unit: "kilometer" },
          ],
        };
      }

      const optimizationGoal =
        objective === "OUTCOME_TRAFFIC"
          ? "LINK_CLICKS"
          : objective === "OUTCOME_LEADS"
          ? "LEAD_GENERATION"
          : "CONVERSATIONS";

      const adSetPayload: Record<string, unknown> = {
        name: `${name} · Conjunto (${zone})`,
        campaign_id: campData.id,
        daily_budget: Math.round(dailyBudget * 100), // Meta minor units
        billing_event: "IMPRESSIONS",
        optimization_goal: optimizationGoal,
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        targeting: {
          geo_locations: geoLocations,
          age_min: ageMin,
          age_max: ageMax,
        },
        status: "PAUSED",
      };
      if (objective === "OUTCOME_ENGAGEMENT") {
        adSetPayload.destination_type = "WHATSAPP";
        if (cfg.metaPageId) {
          adSetPayload.promoted_object = { page_id: cfg.metaPageId };
        }
      }

      const adSetRes = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(adAccountId)}/adsets`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(adSetPayload),
        }
      );
      const adSetData = await adSetRes.json().catch(() => ({}));

      return NextResponse.json({
        ok: true,
        campaignId: campData.id,
        adSetId: adSetData.id || null,
        adSetWarning: !adSetRes.ok ? adSetData?.error?.message || "" : "",
        message: adSetData.id
          ? `✅ Campaña "${name}" + Conjunto de Anuncios creados en Meta Ads (estado PAUSADA). Sube tu video/Reel en Meta Ads Manager y enciéndela en 1 clic desde aquí.`
          : `✅ Campaña "${name}" creada en Meta Ads (ID ${campData.id}, PAUSADA). Completa el video en Meta Ads Manager.${
              adSetData?.error?.message ? ` (Nota AdSet: ${adSetData.error.message})` : ""
            }`,
      });
    }

    // 2. IN-STORE REEL VIDEO SCRIPT STUDIO (Formats A & B based on El Caminante's real Reels!)
    if (action === "video_script") {
      const product = String(body.product || "").trim();
      const format = String(body.format || "PRESENTER"); // PRESENTER | HANDS_ONLY | PROMO
      const storeLocation = String(body.storeLocation || "Ciudad Quesada y La Fortuna").trim();
      const extraBenefit = String(body.extraBenefit || "").trim();

      if (!product) {
        return NextResponse.json(
          { error: "Escribe qué producto o promoción quieres grabar en el video." },
          { status: 400 }
        );
      }

      const docsSummary = docs
        .map((d) => d.content.replace(/<!--IMPULSA_TRAINING_JSON:[\s\S]*?-->/g, "").slice(0, 900))
        .join("\n")
        .slice(0, 2200);

      const fallbackScript = {
        title: `Reel en tienda: ${product}`,
        duration: format === "HANDS_ONLY" ? "15 segundos" : "25 segundos",
        keyword: product.split(/\s+/)[0]?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "INFO",
        hookTextOverlay: `🔥 ${product.slice(0, 32).toUpperCase()}`,
        scenes: [
          {
            time: "0:00 - 0:04",
            shot:
              format === "HANDS_ONLY"
                ? `Acercamiento vertical con el celular sosteniendo ${product} y girándolo bajo la luz de la tienda.`
                : `Asesor(a) con polo de ${company.brandName} sosteniendo ${product} frente a cámara en la tienda.`,
            spoken: `¿Buscas ${product}? Mira lo que acaba de llegar a ${company.brandName}.`,
            onScreenText: `LO NUEVO EN ${company.brandName.toUpperCase()}`,
          },
          {
            time: "0:04 - 0:15",
            shot: `3 tomas rápidas de 3 segundos mostrando detalles, calidad, colores o tallas disponibles en estante.`,
            spoken: `Calidad garantizada, atención en ${storeLocation} y envíos a todo Costa Rica.${
              extraBenefit ? ` Además: ${extraBenefit}.` : ""
            }`,
            onScreenText: `CALIDAD + ENVÍOS A TODO CR`,
          },
          {
            time: "0:15 - 0:23",
            shot: `Toma final mostrando el producto de frente + gesto señalando el botón de mensaje.`,
            spoken: `Escríbenos la palabra ${
              product.split(/\s+/)[0]?.toUpperCase() || "INFO"
            } por mensaje y te enviamos precio y disponibilidad ahora mismo.`,
            onScreenText: `ESCRIBE «${product.split(/\s+/)[0]?.toUpperCase() || "INFO"}» POR MENSAJE`,
          },
        ],
        caption: `🔥 ${product} disponible en ${company.brandName} (${storeLocation}).\n${
          extraBenefit ? `✅ ${extraBenefit}\n` : ""
        }📦 Envíos a todo Costa Rica.\n👇 Toca «Enviar mensaje» y escríbenos para cotizar hoy mismo.`,
        hashtags: "#CostaRica #SanCarlos #CiudadQuesada #LaFortuna #ComprasCR",
        targetingTip: `Objetivo: Interacción → Mensajes a WhatsApp. Presupuesto inicial recomendado: ₡3.000/día en ${storeLocation} (18–55 años).`,
      };

      if (!cfg.aiApiKey) {
        return NextResponse.json({ ok: true, mode: "template", script: fallbackScript });
      }

      try {
        const formatDesc =
          format === "HANDS_ONLY"
            ? "FORMATO SIN ROSTRO (15 seg): solo manos girando el producto en la tienda mostrando perfil, detalles y empaque con cortes rápidos y textos grandes en pantalla."
            : format === "PROMO"
            ? "FORMATO PROMO / TEMPORADA (20-25 seg): ritmo enérgico destacando oferta limitada, pares únicos o facilidades de pago."
            : "FORMATO ASESOR(A) EN TIENDA + B-ROLL (25 seg): asesor con camiseta de la empresa y micrófono de solapa hablando a cámara, intercalado con acercamientos del producto y cierre con palabra clave para escribir por mensaje.";

        const prompt = `Eres director creativo de anuncios Reels para Facebook e Instagram en Costa Rica (estilo cercano, claro y 100% SIN faltas de ortografía).
EMPRESA: ${company.brandName}
PRODUCTO / PROMO: ${product}
SUCURSALES / ZONA: ${storeLocation}
BENEFICIO EXTRA: ${extraBenefit || "Usar beneficios reales del negocio si están en la base de conocimiento"}
${formatDesc}

CONOCIMIENTO REAL DEL NEGOCIO (usa estos datos reales: garantías, Coopelesca, Tasa Cero, envíos, etc. si aplican):
${docsSummary || "(Sin documentos adicionales)"}

Devuelve ÚNICAMENTE un JSON válido (sin markdown ni texto extra):
{
  "title": "Nombre del Reel",
  "duration": "15-25 segundos",
  "keyword": "PALABRA_CLAVE_EN_MAYUSCULAS (1 sola palabra bien escrita, ej. GARMIN o TRAIL)",
  "hookTextOverlay": "Texto corto de gancho para poner arriba en el video (máx 35 chars, ortografía impecable)",
  "scenes": [
    {"time": "0:00 - 0:04", "shot": "Instrucción exacta de qué grabar con el celular", "spoken": "Lo que dice la persona (o vacío si es sin rostro)", "onScreenText": "Texto breve en pantalla"},
    {"time": "0:04 - 0:14", "shot": "...", "spoken": "...", "onScreenText": "..."},
    {"time": "0:14 - 0:22", "shot": "...", "spoken": "...", "onScreenText": "..."}
  ],
  "caption": "Descripción completa para Facebook e Instagram con emojis moderados, ubicación, facilidades de pago/garantía y llamado a enviar mensaje",
  "hashtags": "#Hasta6HashtagsLocales",
  "targetingTip": "Recomendación concreta de presupuesto en colones (ej. ₡3.000/día), zona y público para Meta Ads"
}`;
        const { text } = await callGeminiResilient({
          apiKey: cfg.aiApiKey,
          preferredModel: cfg.aiModel,
          temperature: 0.6,
          maxOutputTokens: 1100,
          parts: [{ text: prompt }],
        });
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
            return NextResponse.json({ ok: true, mode: "gemini", script: parsed });
          }
        }
      } catch (e) {
        console.error("Video script Gemini error:", e);
      }

      return NextResponse.json({ ok: true, mode: "template", script: fallbackScript });
    }

    // 2B. PHOTO-TO-REEL STUDIO PLAN + CINEMATIC AI PROMPT (Clean Photo-Only or Commercial)
    if (action === "photo_reel_plan") {
      const product = String(body.product || "Productos destacados").trim();
      const photoCount = Math.max(2, Math.min(12, Number(body.photoCount) || 5));
      const priceOrOffer = String(body.priceOrOffer || "").trim();
      const format = body.format === "horizontal" ? "16:9" : "9:16";
      const onlyPhotosMode = Boolean(body.onlyPhotosMode);
      const kw = product.split(/\s+/)[0]?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "PRECIO";

      const fallbackPlan = {
        hook: `LO NUEVO EN ${company.brandName.toUpperCase()}`,
        priceBadge: priceOrOffer || "Envíos a todo Costa Rica · Consulta hoy",
        ctaKeyword: kw,
        ctaText: `👇 Comenta «${kw}» y te enviamos DM`,
        slideCaptions: Array.from({ length: photoCount }, (_, i) =>
          i === 0
            ? `Descubre ${product}`
            : i === photoCount - 1
            ? `Disponible hoy en ${company.brandName}`
            : `Detalle y calidad real · Foto ${i + 1}`
        ),
        socialCaption: `🔥 ${product} disponible en ${company.brandName}.\n${
          priceOrOffer ? `✅ ${priceOrOffer}\n` : ""
        }👇 Comenta «${kw}» y te enviamos precio y disponibilidad por mensaje privado al instante.`,
        hashtags: "#CostaRica #ReelsCR #Anuncios #ComprasCR #Emprendimiento",
        cinematicAiPrompt: onlyPhotosMode
          ? `Turn these ${photoCount} photos of ${product} (${company.brandName}) into a 15-second cinematic showcase video in ${format}. Preserve the exact design, textures, materials, colors, and proportions of every product. Use smooth forward camera moves, subtle parallax, natural depth, and seamless directional transitions between photos. Keep geometry 100% stable: no melting edges, no distorted logos, no captions, no text overlays, no watermarks, and no voiceover. Clean commercial color grading timed to an upbeat modern rhythm.`
          : `Turn these ${photoCount} photos of ${product} (${company.brandName}) into a dynamic 15-second commercial Reel in ${format}. Preserve the exact product textures, materials, and proportions with smooth forward push-ins, subtle parallax, and fast clean transitions synced to a modern beat. Keep geometry stable with realistic lighting and crisp studio contrast.`,
      };

      if (!cfg.aiApiKey) {
        return NextResponse.json({ ok: true, mode: "template", plan: fallbackPlan });
      }

      try {
        const prompt = `Eres director creativo de Reels y anuncios en redes sociales para ${company.brandName} (Costa Rica).
PRODUCTO / COLECCIÓN: ${product}
CANTIDAD DE FOTOS: ${photoCount}
PRECIO / OFERTA: ${priceOrOffer || "No especificado"}
FORMATO: ${format}
MODO ELEGIDO: ${onlyPhotosMode ? "SOLO FOTOS CINEMATOGRÁFICO (sin textos ni logos encima del video)" : "COMERCIAL (con gancho, precio y CTA en pantalla)"}

Devuelve ÚNICAMENTE un JSON válido (sin markdown ni texto extra):
{
  "hook": "Gancho corto en mayúsculas máx 34 chars sin faltas de ortografía",
  "priceBadge": "Etiqueta corta de precio/beneficio máx 42 chars",
  "ctaKeyword": "PALABRA_CLAVE_1_PALABRA (ej. PRECIO o QUIERO)",
  "ctaText": "👇 Comenta «PALABRA» y te enviamos DM",
  "slideCaptions": ["Texto breve foto 1", "Texto breve foto 2", "... hasta ${photoCount} elementos"],
  "socialCaption": "Descripción viral lista para publicar en IG/FB invitando a comentar la palabra clave para recibir DM automático",
  "hashtags": "#Hasta6HashtagsLocales",
  "cinematicAiPrompt": "Prompt detallado en inglés listo para pegar en Google Veo, Kling, Runway o Shorty Edit que convierta estas ${photoCount} fotos en un video cinematográfico de 15 segundos en ${format}, preservando texturas y geometría exacta${onlyPhotosMode ? ", especificando explícitamente NO text overlays, NO captions, NO logos, NO voiceover" : ""}"
}`;
        const { text } = await callGeminiResilient({
          apiKey: cfg.aiApiKey,
          preferredModel: cfg.aiModel,
          temperature: 0.55,
          maxOutputTokens: 1000,
          parts: [{ text: prompt }],
        });
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (parsed.cinematicAiPrompt) {
            return NextResponse.json({
              ok: true,
              mode: "gemini",
              plan: { ...fallbackPlan, ...parsed },
            });
          }
        }
      } catch (e) {
        console.error("Photo reel plan Gemini error:", e);
      }

      return NextResponse.json({ ok: true, mode: "template", plan: fallbackPlan });
    }

    // 3. AD COPY VARIATIONS GENERATOR (existing)
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
        targetingTip: `Intereses relacionados a ${audience}, ubicación automática en Reels + Feed de Facebook e Instagram.`,
      },
      {
        angle: "Urgencia y confianza",
        headline: `Atención rápida en ${company.brandName}`,
        primaryText: `Con ${company.brandName} cotizas ${productOrPromo} en minutos y con respaldo real. 📲 Escríbenos hoy mismo haciendo clic en el botón.`,
        cta: "Enviar mensaje por WhatsApp",
        targetingTip: `Objetivo «Interacción → Mensajes» hacia WhatsApp o Instagram Direct.`,
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
      const prompt = `Eres un experto en pauta publicitaria de Meta Ads (Facebook e Instagram) en Costa Rica.
Empresa: ${company.brandName} (${company.companyName})
Producto / Oferta a anunciar: ${productOrPromo}
Objetivo del anuncio: ${objective}
Público objetivo: ${audience}

Devuelve ÚNICAMENTE un JSON válido (sin markdown ni texto extra) con 3 variaciones listas para copiar y pegar en Meta Ads Manager:
{
  "variations": [
    {
      "angle": "Nombre corto del enfoque",
      "headline": "Título llamativo de máximo 45 caracteres",
      "primaryText": "Texto principal persuasivo con emojis moderados y llamado a escribir por WhatsApp/IG/Messenger",
      "cta": "Botón recomendado",
      "targetingTip": "Sugerencia concreta de segmentación y formato en Meta Ads"
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
      { error: err instanceof Error ? err.message : "Error procesando solicitud de Meta Ads." },
      { status: 500 }
    );
  }
}
