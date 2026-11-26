import { getIntegrationSettings, prisma } from "./prisma";
import { callGeminiResilient } from "./gemini";

const VALID_STAGES = [
  "NUEVO",
  "CONTACTADO",
  "COTIZADO",
  "SEGUIMIENTO",
  "NEGOCIACION",
  "GANADO",
  "PERDIDO",
] as const;

type StageId = (typeof VALID_STAGES)[number];

const STAGE_RANK: Record<StageId, number> = {
  NUEVO: 0,
  CONTACTADO: 1,
  COTIZADO: 2,
  SEGUIMIENTO: 3,
  NEGOCIACION: 4,
  GANADO: 5,
  PERDIDO: 5,
};

export interface AutopilotResult {
  updated: boolean;
  stage?: string;
  previousStage?: string;
  estimatedValue?: number;
  tags?: string;
  summary?: string;
  taskCreated?: string;
  reason?: string;
}

function mergeTags(existing: string, incoming: string[]): string {
  const set = new Set<string>();
  for (const t of (existing || "").split(",")) {
    const clean = t.trim();
    if (clean) set.add(clean);
  }
  for (const t of incoming) {
    const clean = String(t || "").trim();
    if (clean) set.add(clean);
  }
  return Array.from(set).slice(0, 8).join(", ");
}

function deterministicFallbackAnalysis(
  messages: Array<{ direction: string; body: string }>,
  currentStage: string
) {
  const allText = messages.map((m) => m.body).join("\n").toLowerCase();
  const hasOutbound = messages.some((m) => m.direction === "OUTBOUND");

  let stage: StageId = (VALID_STAGES.includes(currentStage as StageId)
    ? currentStage
    : "NUEVO") as StageId;

  if (/(comprobante|ya pagu|transferencia realizada|sinpe hecho|gracias por su compra|pedido confirmado|aprobamos la proforma)/i.test(allText)) {
    stage = "GANADO";
  } else if (/(no gracias|ya compramos|cancelar|no nos interesa|descartado)/i.test(allText)) {
    stage = "PERDIDO";
  } else if (/(descuento|rebaja|mejor precio|negociar|ajustar tallas|revisando con mi socio)/i.test(allText)) {
    stage = "NEGOCIACION";
  } else if (/(lo voy a pensar|te confirmo|te aviso|lunes|martes|mi[eé]rcoles|jueves|viernes|pr[oó]xima semana|cierre de recepci[oó]n)/i.test(allText)) {
    stage = "SEGUIMIENTO";
  } else if (/(proforma|cotizaci[oó]n|₡|colones|precio|iva incluido|te paso la propuesta)/i.test(allText) && hasOutbound) {
    stage = "COTIZADO";
  } else if (hasOutbound && stage === "NUEVO") {
    stage = "CONTACTADO";
  }

  const tags: string[] = [];
  if (/uniforme|polo|camisa|pantal[oó]n/i.test(allText)) tags.push("Uniformes");
  if (/bordado|logo/i.test(allText)) tags.push("Bordados");
  if (/zapato|tenis|bota|taco|calzado/i.test(allText)) tags.push("Calzado");
  if (/sicop|licitaci[oó]n|oferta|cartel|2026ld|2026le/i.test(allText)) tags.push("SICOP");
  if (/bal[oó]n|deportiv|gorra|mochila|bolso/i.test(allText)) tags.push("Deportivo");

  // Extract explicit CRC/USD amount if present
  const moneyMatch = allText.match(/(?:₡|crc)\s*([\d.,\s]{4,14})/i);
  let estimatedValue = 0;
  if (moneyMatch) {
    const cleaned = moneyMatch[1].replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(cleaned);
    if (Number.isFinite(parsed) && parsed >= 1000 && parsed < 500_000_000) {
      estimatedValue = Math.round(parsed);
    }
  }

  // Extract explicit date like 03/12/2026 15:00
  let followUpTask: { title: string; dueDateIso: string; type: string } | null = null;
  const dateMatch = allText.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (dateMatch) {
    const dd = Number(dateMatch[1]);
    const mm = Number(dateMatch[2]);
    const yyyy = Number(dateMatch[3]);
    const hh = dateMatch[4] ? Number(dateMatch[4]) : 9;
    const min = dateMatch[5] ? Number(dateMatch[5]) : 0;
    const dt = new Date(yyyy, mm - 1, dd, hh, min);
    if (!Number.isNaN(dt.getTime()) && dt.getTime() > Date.now() - 86400000) {
      followUpTask = {
        title: `Seguimiento / cierre mencionado (${dateMatch[0]})`,
        dueDateIso: dt.toISOString(),
        type: "TAREA",
      };
    }
  }

  return {
    stage,
    company: "",
    contactName: "",
    email: "",
    estimatedValue,
    tags,
    summary: "",
    followUpTask,
  };
}

/**
 * Silent CRM Autopilot ("MonetizaCHAT + Momentum" style):
 * Reads the conversation (both client and seller messages, even in Manual Mode)
 * and automatically updates Kanban stage, tags, estimated value, summary, and Agenda follow-ups.
 */
export async function syncCrmFromConversation(
  conversationId: string,
  explicitWorkspaceId?: string
): Promise<AutopilotResult> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      client: true,
      messages: { orderBy: { createdAt: "desc" }, take: 12 },
    },
  });

  if (!conv || !conv.client) {
    return { updated: false, reason: "Conversación sin cliente vinculado." };
  }

  const workspaceId = explicitWorkspaceId || conv.workspaceId || "default";
  const client = conv.client;
  const chronological = [...conv.messages].reverse();
  if (chronological.length === 0) {
    return { updated: false, reason: "Sin mensajes para analizar." };
  }

  const cfg = await getIntegrationSettings(workspaceId);
  const nowCR = new Date().toLocaleString("es-CR", {
    timeZone: "America/Costa_Rica",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const transcript = chronological
    .map((m) => `[${m.direction === "INBOUND" ? "CLIENTE" : m.senderRole === "AI" ? "BOT" : "VENDEDOR"}]: ${m.body.slice(0, 400)}`)
    .join("\n");

  let analysis = deterministicFallbackAnalysis(chronological, client.stage);

  if (cfg.aiApiKey && cfg.aiProvider === "gemini") {
    try {
      const prompt = `Analiza esta conversación comercial de WhatsApp/Correo para actualizar automáticamente el CRM (Kanban, ficha del cliente y Agenda) SIN intervención del vendedor.

FECHA ACTUAL EN COSTA RICA: ${nowCR}
CLIENTE ACTUAL: Empresa="${client.company}", Contacto="${client.contactName}", EtapaActual="${client.stage}", ValorEstimado=${client.estimatedValue}

CONVERSACIÓN:
${transcript}

Devuelve ÚNICAMENTE un JSON válido (sin markdown ni texto extra):
{
  "stage": "NUEVO | CONTACTADO | COTIZADO | SEGUIMIENTO | NEGOCIACION | GANADO | PERDIDO",
  "company": "Nombre real de empresa/institución si se mencionó (o vacío si no)",
  "contactName": "Nombre real de la persona si se mencionó (o vacío si no)",
  "email": "Correo electrónico si aparece en el chat (o vacío)",
  "estimatedValue": 0,
  "tags": ["máximo 4 etiquetas cortas relevantes, ej. Uniformes, Calzado, SICOP, Proforma"],
  "summary": "Resumen ejecutivo de 1 línea sobre qué busca el cliente y en qué quedó el chat",
  "followUpTask": null o {"title": "Acción concreta con cliente", "dueDateIso": "YYYY-MM-DDTHH:mm:00-06:00", "type": "TAREA | LLAMADA | WHATSAPP"}
}

REGLAS:
- NUEVO: solo saludó o escribió sin respuesta aún.
- CONTACTADO: ya hubo respuesta del vendedor/bot o intercambio inicial.
- COTIZADO: ya se enviaron precios, propuesta o proforma.
- SEGUIMIENTO: el cliente dijo que lo revisa, "lo voy a pensar", "te confirmo tal día", o hay fecha de cierre/recepción de ofertas.
- NEGOCIACION: discuten descuentos, cantidades finales, tallas o condiciones.
- GANADO: confirmaron compra, pedido, factura o comprobante SINPE/transferencia.
- PERDIDO: dijeron explícitamente que no comprarán.
- En followUpTask pon objeto SOLO si mencionaron una fecha/día concreto (ej. "el lunes", "mañana", "03/12/2026 15:00"). Si no, pon null.`;

      const { text } = await callGeminiResilient({
        apiKey: cfg.aiApiKey,
        preferredModel: cfg.aiModel,
        temperature: 0.1,
        maxOutputTokens: 450,
        parts: [{ text: prompt }],
      });
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        const rawStage = String(parsed.stage || "").toUpperCase() as StageId;
        if (VALID_STAGES.includes(rawStage)) {
          analysis.stage = rawStage;
        }
        if (typeof parsed.company === "string") analysis.company = parsed.company.trim();
        if (typeof parsed.contactName === "string") analysis.contactName = parsed.contactName.trim();
        if (typeof parsed.email === "string" && parsed.email.includes("@")) analysis.email = parsed.email.trim();
        if (Number.isFinite(Number(parsed.estimatedValue)) && Number(parsed.estimatedValue) > 0) {
          analysis.estimatedValue = Math.round(Number(parsed.estimatedValue));
        }
        if (Array.isArray(parsed.tags)) {
          analysis.tags = parsed.tags.map(String).filter(Boolean).slice(0, 5);
        }
        if (typeof parsed.summary === "string" && parsed.summary.trim()) {
          analysis.summary = parsed.summary.trim();
        }
        if (parsed.followUpTask && typeof parsed.followUpTask === "object" && parsed.followUpTask.title) {
          const dt = new Date(String(parsed.followUpTask.dueDateIso || ""));
          if (!Number.isNaN(dt.getTime())) {
            analysis.followUpTask = {
              title: String(parsed.followUpTask.title).slice(0, 140),
              dueDateIso: dt.toISOString(),
              type: ["TAREA", "LLAMADA", "WHATSAPP", "CORREO"].includes(String(parsed.followUpTask.type))
                ? String(parsed.followUpTask.type)
                : "TAREA",
            };
          }
        }
      }
    } catch (err) {
      console.error("CRM Autopilot Gemini error (using deterministic fallback):", err);
    }
  }

  // Protect closed GANADO deals from regressing automatically
  const currentStage = (VALID_STAGES.includes(client.stage as StageId)
    ? client.stage
    : "NUEVO") as StageId;
  const nextStage =
    currentStage === "GANADO" && analysis.stage !== "GANADO"
      ? currentStage
      : STAGE_RANK[analysis.stage] >= STAGE_RANK[currentStage] ||
        analysis.stage === "SEGUIMIENTO" ||
        analysis.stage === "PERDIDO"
      ? analysis.stage
      : currentStage;

  const isPhoneOnly = (v: string) => /^\+?\d[\d\s-]*$/.test((v || "").trim());
  const nextCompany =
    analysis.company && (isPhoneOnly(client.company) || !client.company)
      ? analysis.company
      : client.company;
  const nextContact =
    analysis.contactName && (isPhoneOnly(client.contactName) || !client.contactName)
      ? analysis.contactName
      : client.contactName;
  const nextEmail = !client.email && analysis.email ? analysis.email : client.email;
  const nextEstimated =
    analysis.estimatedValue > 0 && analysis.estimatedValue !== client.estimatedValue
      ? analysis.estimatedValue
      : client.estimatedValue;
  const nextTags = mergeTags(client.tags, analysis.tags);

  let nextNotes = client.notes || "";
  if (analysis.summary) {
    const line = `[Resumen IA] ${analysis.summary}`;
    if (/\[Resumen IA\][^\n]*/.test(nextNotes)) {
      nextNotes = nextNotes.replace(/\[Resumen IA\][^\n]*/, line);
    } else {
      nextNotes = nextNotes ? `${line}\n${nextNotes}` : line;
    }
  }

  await prisma.client.update({
    where: { id: client.id },
    data: {
      stage: nextStage,
      company: nextCompany,
      contactName: nextContact,
      email: nextEmail,
      estimatedValue: nextEstimated,
      tags: nextTags,
      notes: nextNotes,
    },
  });

  // Auto-create Agenda follow-up task if a date/commitment was detected (deduplicated)
  let taskCreated = "";
  if (analysis.followUpTask) {
    const existingTask = await prisma.activity.findFirst({
      where: {
        workspaceId,
        clientId: client.id,
        completed: false,
        title: { contains: analysis.followUpTask.title.slice(0, 28) },
      },
      select: { id: true },
    });
    if (!existingTask) {
      await prisma.activity.create({
        data: {
          workspaceId,
          clientId: client.id,
          type: analysis.followUpTask.type,
          title: analysis.followUpTask.title,
          description: analysis.summary || "Agendado automáticamente por CRM Autónomo desde la conversación.",
          dueDate: new Date(analysis.followUpTask.dueDateIso),
          completed: false,
        },
      });
      taskCreated = analysis.followUpTask.title;
    }
  }

  return {
    updated: true,
    previousStage: currentStage,
    stage: nextStage,
    estimatedValue: nextEstimated,
    tags: nextTags,
    summary: analysis.summary,
    taskCreated: taskCreated || undefined,
  };
}
