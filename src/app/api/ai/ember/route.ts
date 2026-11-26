import { NextRequest, NextResponse } from "next/server";
import { getCompanySettings, getIntegrationSettings } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { callGeminiResilient } from "@/lib/gemini";
import { MANUAL_SECTIONS } from "@/lib/manual-content";
import { CONNECTION_GUIDES } from "@/lib/connections-manual-content";

interface EmberChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SuggestedRoute {
  label: string;
  href: string;
}

const ROUTE_CATALOG: Array<{ keywords: RegExp; label: string; href: string }> = [
  { keywords: /anuncio|meta ads|reel|video|foto|guion|campaña|ciclo|1-7-90|whatsapp masivo/i, label: "Ir a Campañas y Anuncios FB/IG", href: "/campanas" },
  { keywords: /cotiz|proforma|pdf|iva|mayoreo/i, label: "Ir a Cotizaciones PDF", href: "/cotizaciones" },
  { keywords: /bandeja|chat|conversaci|comentario|instagram|messenger|correo|compra real|compañero/i, label: "Ir a Conversaciones", href: "/bandeja" },
  { keywords: /cuestionario|entrenar|conocimiento|horario|documento|pol[ií]tica/i, label: "Ir a Conocimiento y docs", href: "/conocimiento" },
  { keywords: /catalogo|catálogo|inventario|producto|foto web/i, label: "Ir a Catálogo e inventario", href: "/catalogo" },
  { keywords: /kanban|embudo|pipeline|venta|oportunidad/i, label: "Ir a Ventas · Kanban", href: "/embudo" },
  { keywords: /contacto|cliente|excel|csv|importar/i, label: "Ir a Contactos", href: "/clientes" },
  { keywords: /aviso|alerta|vendedor|pausa/i, label: "Ir a Avisos al vendedor", href: "/avisos" },
  { keywords: /agenda|cita|reporte|tarea/i, label: "Ir a Agenda y reportes", href: "/agenda" },
  { keywords: /regla|automatiz|bot|agente|simulador/i, label: "Ir a Agente IA y reglas", href: "/automatizaciones" },
  { keywords: /conexi|logo|equipo|vendedor|usuario|respaldo|backup|smtp|token|webhook|empresa/i, label: "Ir a Conexiones y empresa", href: "/configuracion" },
  { keywords: /manual|gu[ií]a|pdf|ayuda/i, label: "Abrir Manual de Uso", href: "/manual" },
];

function inferSuggestedRoutes(text: string): SuggestedRoute[] {
  const found: SuggestedRoute[] = [];
  for (const item of ROUTE_CATALOG) {
    if (item.keywords.test(text)) {
      found.push({ label: item.label, href: item.href });
    }
    if (found.length >= 3) break;
  }
  return found;
}

function buildCompactManualContext(): string {
  const usageSummary = MANUAL_SECTIONS.map((s) => {
    const btns = s.buttons
      .slice(0, 6)
      .map((b) => `• ${b.control} (${b.location}): ${b.purpose}`)
      .join("\n");
    return `[${s.number}] ${s.title} (ruta: ${s.route})\nResumen: ${s.summary}\n${btns}`;
  }).join("\n\n");

  const connSummary = CONNECTION_GUIDES.map(
    (g) => `[Guía ${g.badge}] ${g.title}: ${g.subtitle}`
  ).join("\n");

  return `${usageSummary}\n\nGUÍAS TÉCNICAS DE CONEXIONES:\n${connSummary}`;
}

function buildLocalFallbackAnswer(question: string): { reply: string; suggestedRoutes: SuggestedRoute[] } {
  const q = question.toLowerCase();
  const routes = inferSuggestedRoutes(question);

  // Score sections by keyword overlap
  const tokens = q
    .replace(/[^a-záéíóúñ0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  let bestSection = MANUAL_SECTIONS[0];
  let bestScore = -1;

  for (const sec of MANUAL_SECTIONS) {
    const haystack = `${sec.title} ${sec.summary} ${sec.buttons.map((b) => `${b.control} ${b.purpose}`).join(" ")}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (haystack.includes(t)) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSection = sec;
    }
  }

  const steps = bestSection.buttons
    .slice(0, 4)
    .map((b, i) => `${i + 1}. **${b.control}** (${b.location}): ${b.purpose}`)
    .join("\n");

  const reply =
    bestScore > 0
      ? `¡Hola! Soy **Ember** 🔥. Para lo que buscas, entra a **${bestSection.title}** (\`${bestSection.route}\`):\n\n${bestSection.summary}\n\n**Pasos y botones clave:**\n${steps}${
          bestSection.tip ? `\n\n💡 *Tip:* ${bestSection.tip}` : ""
        }`
      : `¡Hola! Soy **Ember**, tu agente de ayuda dentro de **impulsa CRM** 🔥.\n\nPuedo guiarte paso a paso en:\n1. **Anuncios FB/IG sin terceros** (crear Reels desde fotos, guiones IA y lanzar campañas Meta Ads).\n2. **Cotizaciones PDF con IA** en 3 pasos con tu logo e IVA.\n3. **Auto-respuesta a comentarios** de Instagram/Facebook («Precio» → DM en 2 seg).\n4. **Cuestionario Guiado IA (7 secciones)** para entrenar tu bot en 5 minutos.\n5. **Conexiones, Equipo, Respaldos semanales y Manual en PDF**.\n\n¿Qué necesitas hacer ahorita?`;

  return {
    reply,
    suggestedRoutes:
      routes.length > 0
        ? routes
        : [
            { label: "Ir a Campañas y Anuncios", href: "/campanas" },
            { label: "Abrir Manual de Uso", href: "/manual" },
          ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const [cfg, company] = await Promise.all([
      getIntegrationSettings(workspaceId),
      getCompanySettings(workspaceId),
    ]);

    const body = await req.json().catch(() => ({}));
    const message = String(body.message || "").trim();
    const currentPath = String(body.currentPath || "/").trim();
    const history: EmberChatMessage[] = Array.isArray(body.history)
      ? body.history
          .slice(-6)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((m: any) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content || "").slice(0, 700),
          }))
      : [];

    if (!message) {
      return NextResponse.json({ error: "Escribe tu pregunta para Ember." }, { status: 400 });
    }

    const suggestedRoutes = inferSuggestedRoutes(message);

    if (!cfg.aiApiKey) {
      const local = buildLocalFallbackAnswer(message);
      return NextResponse.json({
        ok: true,
        mode: "local",
        reply: local.reply,
        suggestedRoutes: local.suggestedRoutes,
      });
    }

    const manualContext = buildCompactManualContext().slice(0, 14000);
    const connStatus = [
      `Empresa activa: ${company.brandName} (moneda: ${company.defaultCurrency || "CRC"})`,
      `Pantalla actual del usuario: ${currentPath}`,
      `WhatsApp Cloud API: ${cfg.metaPhoneNumberId && cfg.metaAccessToken ? "Conectado" : "Pendiente"}`,
      `Facebook/Instagram Page: ${cfg.metaPageId ? "Conectado" : "Pendiente"}`,
      `Meta Ad Account (Anuncios): ${cfg.metaAdAccountId ? `Conectado (${cfg.metaAdAccountId})` : "Pendiente"}`,
      `Correo SMTP: ${cfg.smtpHost ? "Conectado" : "Pendiente"}`,
    ].join("\n");

    const systemInstruction = `Eres Ember, el agente de ayuda inteligente integrado dentro de impulsa CRM.
Tu personalidad: cercano, ágil, claro, profesional, en español natural (Costa Rica/Latinoamérica), enfocado en ayudar al dueño o vendedor a lograr resultados rápido sin tecnicismos innecesarios.

REGLAS ESTRICTAS:
1. Responde con pasos numerados cortos, indicando el nombre EXACTO del módulo y los botones tal como existen en impulsa CRM.
2. Sé conciso (máximo 180-220 palabras) salvo que el usuario pida un guion o texto completo.
3. Si te piden ideas de anuncios, guiones de Reels o mensajes para clientes, dales el texto listo para copiar y pegar sin faltas de ortografía.
4. Nunca inventes funciones que no estén en el manual de impulsa CRM. (Por ejemplo, recuerda que Meta Cloud API NO permite publicar Estados de WhatsApp automáticamente).
5. Recuerda que en Campañas → Anuncios FB & IG también existe el "Creador de Videos / Reels desde Fotos" con dos modos: Modo Solo Fotos (cinematográfico limpio sin textos encima) y Modo Comercial (con gancho, precio y CTA), además del Prompt Cinematográfico IA para Veo, Kling o Shorty Edit.

ESTADO ACTUAL DEL ESPACIO DE TRABAJO:
${connStatus}

CONOCIMIENTO OFICIAL DE IMPULSA CRM (MANUAL DE USO Y CONEXIONES):
${manualContext}`;

    const convoPrompt = [
      ...history.map((h) => `${h.role === "user" ? "USUARIO" : "EMBER"}: ${h.content}`),
      `USUARIO: ${message}`,
    ].join("\n\n");

    try {
      const result = await callGeminiResilient({
        apiKey: cfg.aiApiKey,
        preferredModel: cfg.aiModel || "gemini-flash-lite-latest",
        systemInstruction,
        parts: [{ text: convoPrompt }],
        temperature: 0.35,
        maxOutputTokens: 700,
      });

      const routesFromReply = inferSuggestedRoutes(`${message} ${result.text}`);
      return NextResponse.json({
        ok: true,
        mode: "ai",
        model: result.modelUsed,
        reply: result.text,
        suggestedRoutes: routesFromReply.length > 0 ? routesFromReply : suggestedRoutes,
      });
    } catch (aiErr) {
      console.warn("Ember Gemini fallback:", aiErr);
      const local = buildLocalFallbackAnswer(message);
      return NextResponse.json({
        ok: true,
        mode: "local",
        reply: local.reply,
        suggestedRoutes: local.suggestedRoutes,
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error consultando a Ember." },
      { status: 500 }
    );
  }
}
