import { getIntegrationSettings, prisma } from "./prisma";
import { callGeminiResilient } from "./gemini";

const ALREADY_BUILT_CAPABILITIES = [
  "WhatsApp Cloud API 2-way, Meta Templates, Interactive Reply Buttons, Audio IA (Gemini TTS), Voice transcription, Visual product stock search, BSUIDs/Usernames, WhatsApp Business Calling API (WebRTC VoIP)",
  "Facebook Messenger & Instagram Direct 2-way + Auto-reply to FB/IG comments + Private Reply DM + Meta Ads live metrics/launcher + Photo-to-Reel Studio",
  "AI Sales Agent 24/7 + Compra real vs Consulta filter + CRM Autopilot (auto Kanban, tags, tasks) + Ember in-app AI Help Assistant",
  "Proformas PDF with custom logo + Interactive Client Portal (1-click approve, SINPE receipt Vision AI validation, partial deposits/balance, card payment links, CR Hacienda 4.4 FE JSON/API)",
  "Public Mini-Catalog Web Storefront (/tienda), Public Calendly-style Booking (/agendar) with WhatsApp reminders, Round-Robin agent assignment + SLA metrics",
  "Outbound Webhooks (Odoo/n8n/Zapier/Make with HMAC) + Public REST API (/api/v1/leads), Installable PWA + live chimes, Internal Team Notes + / quick replies, Audit Log, Weekly Executive Report, Weekly Backup Email, Multi-tenant SaaS SuperAdmin",
];

interface RawRadarCandidate {
  category?: string;
  title?: string;
  summary?: string;
  sourceUrl?: string;
  impact?: string;
  effort?: string;
}

export async function runInnovationRadarScan(workspaceId: string): Promise<{
  ok: boolean;
  addedCount: number;
  usedLiveSearch: boolean;
  items?: Array<{ id: string; title: string; category: string; impact: string }>;
  error?: string;
}> {
  const cfg = await getIntegrationSettings(workspaceId);
  const apiKey = (cfg.aiApiKey || process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return {
      ok: false,
      addedCount: 0,
      usedLiveSearch: false,
      error: "Configura tu API Key de Gemini en Conexiones → Agente de IA para ejecutar el Radar.",
    };
  }

  const existing = await prisma.innovationRadarItem.findMany({
    where: { workspaceId },
    select: { title: true },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const existingTitles = existing.map((e) => e.title.toLowerCase().trim());

  const currentMonthYear = new Date().toLocaleDateString("es-CR", { month: "long", year: "numeric" });
  const prompt = `Eres el Director de Producto e Innovación de impulsa CRM (SaaS multiempresa en Costa Rica y LATAM).
Hoy es ${currentMonthYear}. Busca en la web las novedades MÁS RECIENTES y relevantes para mantener a impulsa CRM siempre a la vanguardia frente a Kommo, HubSpot, GoHighLevel, Odoo y Respond.io en estas 4 áreas:
1. META_WA: nuevas funciones de WhatsApp Cloud API, WhatsApp Flows, Calling API, Instagram/Messenger DM, Meta Ads.
2. CRM_IA: agentes autónomos de ventas, memoria de clientes, automatizaciones con IA, productividad de vendedores.
3. VENTAS_ADS: nuevas funciones virales de Reels/TikTok/Meta Ads para captación de leads.
4. CR_PAGOS: novedades de Facturación Electrónica Costa Rica (Hacienda 4.4), SINPE, pasarelas LATAM o comercio electrónico.

IMPORTANTE: NO repitas funciones que impulsa CRM YA TIENE implementadas:
${ALREADY_BUILT_CAPABILITIES.map((x) => `- ${x}`).join("\n")}

Tampoco repitas estos títulos ya guardados en el radar:
${existingTitles.slice(0, 25).join(" | ") || "(ninguno aún)"}

Devuelve ÚNICAMENTE un JSON válido (sin markdown ni texto extra) con exactamente 4 o 5 mejoras NUEVAS y accionables:
{
  "items": [
    {
      "category": "META_WA" | "CRM_IA" | "VENTAS_ADS" | "CR_PAGOS",
      "title": "Título corto y claro en español (máx 80 caracteres)",
      "summary": "Qué salió nuevo en la red y exactamente cómo ayudaría a vender más en impulsa CRM (2 frases claras).",
      "sourceUrl": "URL real de referencia si existe o vacío",
      "impact": "ALTO" | "MEDIO" | "BAJO",
      "effort": "RAPIDO" | "MEDIO" | "PROYECTO"
    }
  ]
}`;

  let rawText = "";
  let usedLiveSearch = false;

  // 1. Try Gemini 2.5 Flash with native Google Search Grounding (live web access!)
  try {
    const searchUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;
    const res = await fetch(searchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 1600 },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      rawText = parts.map((p: { text?: string }) => p.text || "").join("\n").trim();
      if (rawText) usedLiveSearch = true;
    }
  } catch {
    // Fallback below
  }

  // 2. Resilient fallback if Google Search Grounding quota/tier isn't available
  if (!rawText) {
    try {
      const fallback = await callGeminiResilient({
        apiKey,
        preferredModel: cfg.aiModel || "gemini-flash-lite-latest",
        temperature: 0.4,
        maxOutputTokens: 1400,
        parts: [{ text: prompt }],
      });
      rawText = fallback.text;
    } catch (err) {
      return {
        ok: false,
        addedCount: 0,
        usedLiveSearch: false,
        error: err instanceof Error ? err.message : "No se pudo consultar a Gemini.",
      };
    }
  }

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { ok: false, addedCount: 0, usedLiveSearch, error: "Gemini no devolvió un formato JSON válido." };
  }

  let parsedItems: RawRadarCandidate[] = [];
  try {
    const obj = JSON.parse(jsonMatch[0]);
    parsedItems = Array.isArray(obj.items) ? obj.items : [];
  } catch {
    return { ok: false, addedCount: 0, usedLiveSearch, error: "No se pudo leer la lista de hallazgos." };
  }

  const validCats = new Set(["META_WA", "CRM_IA", "VENTAS_ADS", "CR_PAGOS"]);
  const validImpacts = new Set(["ALTO", "MEDIO", "BAJO"]);
  const validEfforts = new Set(["RAPIDO", "MEDIO", "PROYECTO"]);

  const created: Array<{ id: string; title: string; category: string; impact: string }> = [];
  for (const cand of parsedItems.slice(0, 6)) {
    const title = String(cand.title || "").trim().slice(0, 120);
    const summary = String(cand.summary || "").trim().slice(0, 600);
    if (!title || !summary) continue;
    if (existingTitles.includes(title.toLowerCase())) continue;

    const category = validCats.has(String(cand.category)) ? String(cand.category) : "CRM_IA";
    const impact = validImpacts.has(String(cand.impact)) ? String(cand.impact) : "ALTO";
    const effort = validEfforts.has(String(cand.effort)) ? String(cand.effort) : "MEDIO";
    const rawUrl = String(cand.sourceUrl || "").trim();
    const sourceUrl = rawUrl.startsWith("https://") ? rawUrl.slice(0, 400) : "";

    const row = await prisma.innovationRadarItem.create({
      data: {
        workspaceId,
        category,
        title,
        summary,
        sourceUrl,
        impact,
        effort,
        status: "NUEVA",
      },
    });
    existingTitles.push(title.toLowerCase());
    created.push({ id: row.id, title: row.title, category: row.category, impact: row.impact });
  }

  return { ok: true, addedCount: created.length, usedLiveSearch, items: created };
}
