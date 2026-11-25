import { getCompanySettings, getIntegrationSettings, prisma } from "./prisma";
import { formatMoney } from "./format";
import { sendCorporateEmail } from "./email";
import { getActiveWorkspaceId } from "./workspace";
import { callGeminiResilient } from "./gemini";
import { fetchLiveShoeDetailsAndSizes, searchCaminanteStore } from "./vision-stock";

export interface StorePhotoCard {
  name: string;
  sku: string;
  priceText: string;
  sizesSummary: string;
  url: string;
  imageUrl: string;
}

export interface AiReplyInput {
  userMessage: string;
  channel?: string;
  clientName?: string;
  clientCompany?: string;
  conversationHistory?: { role: string; body: string }[];
}

export interface ExtractedQuoteItem {
  productId?: string;
  quantity: number;
  title: string;
  description: string;
  unitPrice: number;
}

async function buildCatalogContext(workspaceId: string): Promise<string> {
  const products = await prisma.product.findMany({
    where: { workspaceId, active: true },
    orderBy: { category: "asc" },
    take: 50,
  });
  return products
    .map(
      (p) =>
        `- [${p.sku}] ${p.name} (${p.category}): ${formatMoney(p.price, "CRC")} IVA incluido | Existencias: ${p.stock} ${p.unit}(s)` +
        (p.wholesalePrice ? ` | Mayoreo (${p.wholesaleMinQty}+): ${formatMoney(p.wholesalePrice, "CRC")}` : "") +
        (p.description ? ` — ${p.description.replace(/\n/g, " ")}` : "")
    )
    .join("\n");
}

async function buildDocumentsContext(workspaceId: string): Promise<string> {
  const docs = await prisma.knowledgeDocument.findMany({
    where: { workspaceId, active: true },
    orderBy: { updatedAt: "desc" },
    take: 15,
  });
  if (docs.length === 0) return "";
  return docs
    .map((d) => `### [${d.category}] ${d.title}\n${d.content.slice(0, 1500)}`)
    .join("\n\n");
}

async function callGemini(apiKey: string, model: string, systemPrompt: string, userPrompt: string) {
  const res = await callGeminiResilient({
    apiKey,
    preferredModel: model,
    systemInstruction: systemPrompt,
    parts: [{ text: userPrompt }],
    temperature: 0.35,
    maxOutputTokens: 900,
  });
  return res.text;
}

async function callOpenAI(apiKey: string, model: string, systemPrompt: string, userPrompt: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Error OpenAI API (${res.status})`);
  }
  return (data?.choices?.[0]?.message?.content || "").trim();
}

// Local smart assistant fallback when no API Key is entered yet
async function localSmartReply(input: AiReplyInput, workspaceId: string): Promise<string> {
  const company = await getCompanySettings(workspaceId);
  const [products, docs] = await Promise.all([
    prisma.product.findMany({ where: { workspaceId, active: true } }),
    prisma.knowledgeDocument.findMany({ where: { workspaceId, active: true } }),
  ]);
  const q = input.userMessage.toLowerCase();
  const STOPWORDS = new Set([
    "hola", "buenas", "buenos", "dias", "tardes", "noches", "para", "como", "esta", "este",
    "estos", "estas", "tienen", "tiene", "quiero", "ocupo", "necesito", "favor", "gracias",
    "donde", "cuando", "cual", "quien", "sobre", "nota", "recibida", "audio", "configura",
    "openai", "gemini", "integraciones", "vivo", "horario", "horarios", "abren", "cierran",
  ]);
  const meaningfulWords = q
    .split(/[^a-záéíóúñ0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));

  const greeting = input.clientName ? `¡Hola ${input.clientName}!` : "¡Hola! Gracias por escribir a Caminante Corporativo.";

  if (q.includes("horario") || q.includes("abierto") || q.includes("abren") || q.includes("cierran") || q.includes("navide")) {
    const navDoc = docs.find((d) => /navide/i.test(`${d.title} ${d.content}`));
    const schedDocs = docs.filter((d) => /(horario|apertura|cierre|navide)/i.test(`${d.title} ${d.content}`));
    if (q.includes("navide") && navDoc) {
      return `${greeting}\n\n*${navDoc.title}:*\n${navDoc.content}\n\nEstamos en ${company.address}. ¿En qué más le podemos ayudar?`;
    }
    if (schedDocs.length > 0) {
      const text = schedDocs.map((d) => `*${d.title}:*\n${d.content}`).join("\n\n");
      return `${greeting}\n\n${text}\n\nTel: ${company.phone} · WhatsApp: ${company.whatsapp}.`;
    }
  }

  if (q.includes("ubicaci") || q.includes("direcci")) {
    return `${greeting} Estamos ubicados en *${company.address}* (San Carlos, Alajuela). Tel: ${company.phone} | WhatsApp: ${company.whatsapp}.`;
  }

  const matched =
    meaningfulWords.length > 0
      ? products.filter((p) => {
          const haystack = `${p.name} ${p.category} ${p.sku}`.toLowerCase();
          return meaningfulWords.some((kw) => haystack.includes(kw));
        })
      : [];

  const matchedDoc =
    meaningfulWords.length > 0
      ? docs.find((d) => {
          const haystack = `${d.title} ${d.category}`.toLowerCase();
          return meaningfulWords.some((kw) => haystack.includes(kw));
        })
      : undefined;

  if (matched.length > 0) {
    const lines = matched.slice(0, 4).map((p) => {
      const mayoreo = p.wholesalePrice
        ? ` (mayoreo desde ${p.wholesaleMinQty} uds: ${formatMoney(p.wholesalePrice, "CRC")})`
        : "";
      return `• *${p.name}*: ${formatMoney(p.price, "CRC")} IVA incluido${mayoreo}`;
    });
    return `${greeting} Con mucho gusto te ayudamos con tu cotización.\n\nDe nuestro catálogo te comparto estas opciones en colones (IVA 13% incluido):\n${lines.join("\n")}\n\nPara prepararte la Factura Proforma oficial en PDF hoy mismo, indícanos:\n1. Cantidades y tallas aproximadas\n2. Si requiere bordado o personalización\n3. Nombre de la empresa y correo electrónico\n\nQuedamos a tus órdenes — ${company.brandName} (WhatsApp ${company.whatsapp}).`;
  }

  if (q.includes("pago") || q.includes("sinpe") || q.includes("cuenta") || q.includes("banco")) {
    return `${greeting} Aceptamos pagos por:\n• SINPE Móvil: ${company.sinpePhone}\n• Transferencia bancaria (BN, BCR, BAC y Davivienda)\n\nTambién manejamos crédito a 30 días para instituciones y clientes corporativos autorizados. ¿Te preparo una Factura Proforma o confirmamos el pedido?`;
  }

  if (matchedDoc) {
    return `${greeting} Según nuestra información de *${matchedDoc.title}*:\n\n${matchedDoc.content.slice(0, 380)}\n\n¿Deseas que un asesor te prepare una Factura Proforma personalizada?`;
  }

  return `${greeting} En *${company.brandName}* manejamos:\n• Uniformes (corporativos, escolares e industriales)\n• Bordados computarizados\n• Artículos promocionales\n• Artículos deportivos\n• Zapatos y botas de seguridad\n\nTodos nuestros precios son en colones (₡) con IVA 13% incluido (o desglosado si lo requieres). Cuéntame qué producto y cantidad necesitas para enviarte tu Factura Proforma hoy mismo.`;
}

async function lookupLiveStoreForQuery(userMessage: string): Promise<{
  contextText: string;
  photos: StorePhotoCard[];
}> {
  const lower = userMessage.toLowerCase();
  const isScheduleOnly = /(horario|abren|cierran|navide|ubicaci|direcci|sinpe|iban|cuenta bancaria)/i.test(lower) &&
    !/(foto|imagen|tenis|zapato|bota|taco|joma|skecher|nike|adidas|puma|new balance|asics|gorra|bolso|balon|uniforme|camisa|short)/i.test(lower);
  if (isScheduleOnly || lower.trim().length < 4) {
    return { contextText: "", photos: [] };
  }

  const wantsProductInfo =
    /(foto|imagen|ver |muestra|enseñ|modelos|tienen|precio|cuanto|vale|tenis|zapato|bota|taco|sandalia|gorra|bolso|mochila|balon|camisa|short|buso|joma|skecher|nike|adidas|puma|new balance|asics|umbro|mizuno|reebok|under armour|vans|converse|kayman|dinosaurio|top flex|glide|bobs|530|574|9060|327)/i.test(
      lower
    );
  if (!wantsProductInfo) {
    return { contextText: "", photos: [] };
  }

  try {
    // Strip conversational filler to isolate brand/product terms
    const cleaned = lower
      .replace(
        /\b(hola|buenas|buenos|dias|tardes|noches|tienen|tiene|tendran|me|puedes|puede|pasar|enviar|mandar|mostrar|enseñar|ver|fotos|foto|imagenes|imagen|de|del|la|las|el|los|un|una|unos|unas|por|favor|cual|cuales|precio|precios|cuanto|valen|vale|cuesta|cuestan|busco|ocupo|necesito|quiero|disponibles|disponible|tallas|talla|en|stock|tienda|pagina|modelos|modelo)\b/gi,
        " "
      )
      .replace(/[^a-záéíóúñ0-9.\s-]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned.length < 3) return { contextText: "", photos: [] };

    const candidates = await searchCaminanteStore(cleaned, undefined, 6, false);
    if (candidates.length === 0) return { contextText: "", photos: [] };

    const top3 = await Promise.all(
      candidates.slice(0, 3).map((c) => fetchLiveShoeDetailsAndSizes(c))
    );

    const photos: StorePhotoCard[] = top3
      .filter((p) => Boolean(p.imageUrl))
      .map((p) => {
        const avail = p.sizes.filter((s) => s.totalAvailable > 0);
        const sizesSummary =
          avail.length > 0
            ? avail
                .map((s) => {
                  const br: string[] = [];
                  if (s.quesada > 0) br.push(`CQ:${s.quesada}`);
                  if (s.fortuna > 0) br.push(`LF:${s.fortuna}`);
                  if (s.online > 0) br.push(`Web:${s.online}`);
                  return `${s.size} (${br.join("/")})`;
                })
                .join(", ")
            : p.sizes.length > 0
            ? `Tallas: ${p.sizes.map((s) => s.size).join(", ")}`
            : "Consultar tallas";
        return {
          name: p.name,
          sku: p.sku,
          priceText: p.priceText,
          sizesSummary,
          url: p.url,
          imageUrl: p.imageUrl,
        };
      });

    const contextText = top3
      .map(
        (p) =>
          `- ${p.name} (Ref: ${p.sku}) | Precio: ${p.priceText} IVA incl. | URL: ${p.url} | Foto: ${p.imageUrl} | Tallas en vivo: ${
            p.sizes
              .filter((s) => s.totalAvailable > 0)
              .map((s) => `${s.size} (Quesada:${s.quesada}, Fortuna:${s.fortuna}, Online:${s.online})`)
              .join("; ") || "consultar disponibilidad"
          }`
      )
      .join("\n");

    return { contextText, photos };
  } catch (err) {
    console.error("Live store text lookup error:", err);
    return { contextText: "", photos: [] };
  }
}

export async function generateAiReply(input: AiReplyInput) {
  const workspaceId = await getActiveWorkspaceId();
  const cfg = await getIntegrationSettings(workspaceId);
  const [catalog, docs, liveStore] = await Promise.all([
    buildCatalogContext(workspaceId),
    buildDocumentsContext(workspaceId),
    lookupLiveStoreForQuery(input.userMessage),
  ]);

  const todayCR = new Date().toLocaleDateString("es-CR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Costa_Rica",
  });

  const systemPrompt = `${cfg.aiSystemPrompt || "Eres el asistente comercial de Caminante Corporativo en Costa Rica."}

FECHA ACTUAL EN COSTA RICA: ${todayCR}

REGLAS ESTRICTAS DE CONOCIMIENTO:
- Responde SIEMPRE usando exactamente los datos de "DOCUMENTOS CARGADOS DEL NEGOCIO" (nunca inventes horarios ni precios que no estén allí).
- Si el cliente pregunta específicamente por el "horario navideño", responde EXCLUSIVAMENTE con el texto del documento "HORARIO NAVIDEÑO" si existe.
- Si el cliente pregunta por el horario general y existen ambos documentos (normal y navideño) activos, muéstrale el horario vigente aclarando ambos claramente.

BASE DE CONOCIMIENTO:
${cfg.aiKnowledgeBase}

DOCUMENTOS CARGADOS DEL NEGOCIO:
${docs || "(Ninguno aún)"}

CATÁLOGO ACTUAL EN COLONES (IVA 13% INCLUIDO):
${catalog}

RESULTADOS EN VIVO DE LA TIENDA WEB (https://elcaminantecr.com/tienda/):
${liveStore.contextText || "(Sin consulta específica de producto web en este mensaje)"}
${liveStore.photos.length > 0 ? "\nIMPORTANTE: El sistema enviará automáticamente las fotos de los productos encontrados arriba por WhatsApp junto con tu respuesta. Menciona sus precios, tallas reales y dile al cliente que le compartes las fotos enseguida." : ""}`;

  const historyText = (input.conversationHistory || [])
    .slice(-8)
    .map((m) => `${m.role}: ${m.body}`)
    .join("\n");

  const userPrompt = `Canal: ${input.channel || "WHATSAPP"}
Cliente: ${input.clientName || "Prospecto"} ${input.clientCompany ? `(${input.clientCompany})` : ""}
Historial reciente:
${historyText || "(Primer mensaje)"}

Mensaje actual del cliente:
"${input.userMessage}"

Redacta una respuesta comercial clara, amable, breve y orientada a calificar y cerrar o cotizar.`;

  if (cfg.aiApiKey && cfg.aiProvider === "gemini") {
    try {
      const reply = await callGemini(cfg.aiApiKey, cfg.aiModel, systemPrompt, userPrompt);
      return { reply, mode: "gemini" as const, storePhotos: liveStore.photos };
    } catch (err) {
      const fallback = await localSmartReply(input, workspaceId);
      return {
        reply: fallback,
        mode: "fallback" as const,
        storePhotos: liveStore.photos,
        warning: err instanceof Error ? err.message : "Error llamando a Gemini",
      };
    }
  }

  if (cfg.aiApiKey && cfg.aiProvider === "openai") {
    try {
      const reply = await callOpenAI(cfg.aiApiKey, cfg.aiModel, systemPrompt, userPrompt);
      return { reply, mode: "openai" as const, storePhotos: liveStore.photos };
    } catch (err) {
      const fallback = await localSmartReply(input, workspaceId);
      return {
        reply: fallback,
        mode: "fallback" as const,
        storePhotos: liveStore.photos,
        warning: err instanceof Error ? err.message : "Error llamando a OpenAI",
      };
    }
  }

  const reply = await localSmartReply(input, workspaceId);
  return { reply, mode: "local" as const, storePhotos: liveStore.photos };
}

// Lead qualification + Seller Alert engine ("Avisar al vendedor cuando el cliente está listo para comprar")
export async function qualifyLeadAndNotifySeller(params: {
  clientId: string;
  conversationId?: string;
  messageBody: string;
  isAudio?: boolean;
}) {
  const lower = params.messageBody.toLowerCase();

  // Respect explicit opt-out ("darme de baja", "no contactar", "stop")
  if (/(darme de baja|no contactar|no me escriban|cancelar mensajes|\bstop\b)/i.test(lower)) {
    await prisma.client.update({
      where: { id: params.clientId },
      data: { optOut: true, qualificationStatus: "FRIO", qualificationScore: 0 },
    });
    if (params.conversationId) {
      await prisma.conversation.update({
        where: { id: params.conversationId },
        data: { aiEnabled: false },
      });
    }
    return { score: 0, qualificationStatus: "FRIO", signals: ["Solicitó baja (opt-out respetado)"], alertCreated: null };
  }

  const signals: string[] = [];
  let score = 20;

  if (/\b\d{1,4}\b/.test(lower)) {
    score += 20;
    signals.push("Indicó cantidades específicas");
  }
  if (/(cotiz|proforma|factura|presupuesto|precio)/i.test(lower)) {
    score += 20;
    signals.push("Solicita cotización / proforma");
  }
  if (/(comprar|hacer el pedido|confirm|aprob|lo quiero|vamos con|proced|adelanto|sinpe|cuenta|iban|pagar|transferencia|urgente|para hoy|esta semana)/i.test(lower)) {
    score += 35;
    signals.push("Intención directa de compra / pago / cierre");
  }
  if (/(talla|bordado|logo|color|entrega|env[ií]o|san carlos|alajuela)/i.test(lower)) {
    score += 15;
    signals.push("Detalló especificaciones técnicas o entrega");
  }
  if (params.isAudio) {
    score += 5;
    signals.push("Envió nota de voz (alto interés)");
  }

  score = Math.min(100, score);

  const qualificationStatus =
    score >= 75
      ? "LISTO_PARA_COMPRAR"
      : score >= 50
      ? "CALIENTE"
      : score >= 30
      ? "TIBIO"
      : "FRIO";

  const client = await prisma.client.update({
    where: { id: params.clientId },
    data: {
      qualificationScore: score,
      qualificationStatus,
    },
  });

  let alertCreated = null;
  if (qualificationStatus === "LISTO_PARA_COMPRAR" || score >= 70) {
    const suggestedNextStep = /(sinpe|pagar|confirm|aprob|pedido)/i.test(lower)
      ? "Enviar datos SINPE/IBAN y confirmar fecha de entrega inmediata."
      : "Generar y enviar Factura Proforma PDF ahora mismo para cerrar la venta.";

    // Pause AI bot automatically on handoff to human seller
    if (params.conversationId) {
      await prisma.conversation.update({
        where: { id: params.conversationId },
        data: { aiEnabled: false },
      });
    }

    // Advance Kanban stage if still early
    if (["NUEVO", "CONTACTADO"].includes(client.stage)) {
      await prisma.client.update({
        where: { id: client.id },
        data: { stage: "NEGOCIACION" },
      });
    }

    alertCreated = await prisma.sellerAlert.create({
      data: {
        workspaceId: client.workspaceId,
        clientId: client.id,
        conversationId: params.conversationId || "",
        priority: score >= 80 ? "ALTA" : "MEDIA",
        title: `🔥 ${client.company} está listo para comprar (${score}/100) — Bot pausado`,
        buyingSignals: signals.join(" · "),
        suggestedNextStep,
        score,
      },
    });

    await prisma.activity.create({
      data: {
        workspaceId: client.workspaceId,
        clientId: client.id,
        type: "IA",
        title: `Aviso al vendedor: ${client.company} calificado ${qualificationStatus} (${score}%)`,
        description: `${signals.join(" · ")}. Sugerencia: ${suggestedNextStep}`,
        completed: false,
      },
    });

    // Notify seller via corporate SMTP if configured
    const company = await getCompanySettings();
    const integrations = await getIntegrationSettings();
    if (integrations.smtpHost && integrations.smtpUser && integrations.smtpPass && company.email) {
      await sendCorporateEmail({
        to: company.email,
        subject: `🔥 Aviso CRM: ${client.company} está listo para comprar`,
        text: `El Agente IA calificó a ${client.company} (${client.contactName || "Contacto"}) con ${score}/100.\n\nSeñales detectadas: ${signals.join(", ")}\nMensaje del cliente: "${params.messageBody}"\n\nSiguiente paso sugerido: ${suggestedNextStep}`,
      }).catch(() => {});
    }
  }

  return { score, qualificationStatus, signals, alertCreated };
}

export async function extractQuoteDraftFromText(messageText: string): Promise<{
  jobTitle: string;
  taxMode: string;
  items: ExtractedQuoteItem[];
  source: string;
}> {
  const workspaceId = await getActiveWorkspaceId();
  const cfg = await getIntegrationSettings(workspaceId);
  const products = await prisma.product.findMany({ where: { workspaceId, active: true } });

  const taxMode = messageText.toLowerCase().includes("desglos")
    ? "DESGLOSADO"
    : messageText.toLowerCase().includes("exoner")
    ? "EXONERADO"
    : "IVA_INCLUIDO";

  if (cfg.aiApiKey) {
    try {
      const catalogJson = products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        wholesaleMinQty: p.wholesaleMinQty,
        wholesalePrice: p.wholesalePrice,
        description: p.description,
      }));
      const prompt = `Extrae las líneas de cotización solicitadas en el siguiente mensaje de cliente usando este catálogo (precios en Colones CRC).
Devuelve ÚNICAMENTE un JSON válido sin texto extra con esta forma:
{"jobTitle":"...","taxMode":"IVA_INCLUIDO|DESGLOSADO|EXONERADO","items":[{"productId":"...","quantity":1,"title":"...","description":"...","unitPrice":1000}]}

CATÁLOGO:
${JSON.stringify(catalogJson)}

MENSAJE DEL CLIENTE:
"${messageText}"`;

      const raw =
        cfg.aiProvider === "openai"
          ? await callOpenAI(cfg.aiApiKey, cfg.aiModel, "Devuelve solo JSON válido.", prompt)
          : await callGemini(cfg.aiApiKey, cfg.aiModel, "Devuelve solo JSON válido.", prompt);

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
          return {
            jobTitle: parsed.jobTitle || "COTIZACIÓN SOLICITADA",
            taxMode: parsed.taxMode || taxMode,
            items: parsed.items,
            source: cfg.aiProvider,
          };
        }
      }
    } catch {
      // Fall through to deterministic catalog matcher
    }
  }

  const lower = messageText.toLowerCase();
  const items: ExtractedQuoteItem[] = [];
  const usedIds = new Set<string>();

  const clauses = lower.split(/[,.;\n]| y | e /);
  for (const clause of clauses) {
    const numMatch = clause.match(/\b(\d+)\b/);
    const qty = numMatch ? Math.max(1, parseInt(numMatch[1], 10)) : 1;

    let bestProduct = null;
    let bestScore = 0;

    for (const p of products) {
      if (usedIds.has(p.id)) continue;
      const tokens = `${p.name} ${p.category} ${p.description}`
        .toLowerCase()
        .split(/[^a-záéíóúñ0-9]+/)
        .filter((t) => t.length >= 4);
      let score = 0;
      for (const tok of tokens) {
        if (clause.includes(tok.slice(0, 5))) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestProduct = p;
      }
    }

    if (bestProduct && bestScore >= 1) {
      usedIds.add(bestProduct.id);
      const useWholesale =
        bestProduct.wholesalePrice && qty >= bestProduct.wholesaleMinQty;
      items.push({
        productId: bestProduct.id,
        quantity: qty,
        title: bestProduct.name,
        description: bestProduct.description,
        unitPrice: useWholesale ? bestProduct.wholesalePrice! : bestProduct.price,
      });
    }
  }

  if (items.length === 0 && products[0]) {
    items.push({
      productId: products[0].id,
      quantity: 1,
      title: products[0].name,
      description: products[0].description,
      unitPrice: products[0].price,
    });
  }

  const jobTitle =
    items.length === 1
      ? items[0].title.slice(0, 32)
      : "UNIFORMES Y ARTÍCULOS CORPORATIVOS";

  return { jobTitle, taxMode, items, source: "local-matcher" };
}
