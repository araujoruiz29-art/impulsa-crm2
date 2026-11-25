import { getIntegrationSettings, prisma } from "./prisma";
import { formatMoney } from "./format";
import { callGeminiResilient } from "./gemini";

export interface StoreCandidate {
  idProduct: string;
  idProductAttribute: string;
  name: string;
  caption?: string;
  price: number;
  priceText: string;
  url: string;
  imageUrl: string;
  brand?: string;
  sku?: string;
}

export interface SizeStock {
  size: string;
  attributeId: string;
  quesada: number;
  fortuna: number;
  online: number;
  totalAvailable: number;
}

export interface EnrichedShoeProduct extends StoreCandidate {
  sku: string;
  brand: string;
  description: string;
  colors: string[];
  sizes: SizeStock[];
  inStockTotal: number;
}

export interface VisionAnalysis {
  brand: string;
  modelGuess: string;
  shoeType: string;
  colors: string[];
  searchQueries: string[];
  visualSummary: string;
  provider: string;
}

const DEFAULT_STORE_BASE = "https://elcaminantecr.com/tienda";

interface SitemapProduct {
  idProduct: string;
  name: string;
  caption: string;
  url: string;
  imageUrl: string;
  searchText: string;
  compactText: string;
}

const sitemapCache: {
  base: string;
  fetchedAt: number;
  items: SitemapProduct[];
} = {
  base: "",
  fetchedAt: 0,
  items: [],
};

// Common words/colors that usually don't appear in PrestaShop product titles
const IGNORE_SEARCH_TOKENS = new Set([
  "tenis", "zapato", "zapatos", "calzado", "para", "hombre", "mujer", "dama", "caballero",
  "nino", "nina", "unisex", "color", "tonos", "negro", "negra", "blanco", "blanca",
  "beige", "crema", "marron", "cafe", "azul", "rojo", "roja", "verde", "amarillo",
  "rosado", "rosa", "gris", "naranja", "morado", "celeste", "claro", "oscuro",
  "suela", "con", "sin", "deportivo", "deportivos", "casual", "casuales", "slip", "ins",
]);

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearch(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Fuzzy stem to survive store typos like "Skechers" vs "Skecher" vs "Skeches", "Glide-Step" vs "glidestep"
function tokenStem(t: string): string {
  if (t.startsWith("skech")) return "skech";
  if (t.startsWith("adida")) return "adida";
  if (t.startsWith("reboo")) return "reboo";
  if (t.startsWith("glid")) return "glid";
  if (t.startsWith("cush")) return "cush";
  if (t.length >= 6 && t.endsWith("s")) return t.slice(0, -1);
  return t;
}

// Exclude apparel/accessories when searching for footwear photos
const NON_FOOTWEAR_WORDS = [
  "gorra ", "blusa ", "camisa ", "camiseta ", "short ", "buso ", "pantalon ",
  "media ", "medias ", "bolso ", "mochila ", "jacket ", "sueta ", "sudadera ",
  "balon ", "guante ", "espinillera ", "licra ", "top deportivo", "chaleco ",
];

function isLikelyFootwear(name: string): boolean {
  const low = normalizeSearch(name) + " ";
  if (NON_FOOTWEAR_WORDS.some((w) => low.startsWith(w) || low.includes(" " + w))) {
    return false;
  }
  return true;
}

function toThumbnailUrl(url: string): string {
  if (!url) return "";
  return url.replace("-large_default/", "-home_default/");
}

async function loadSitemapCatalog(storeBase: string = DEFAULT_STORE_BASE): Promise<SitemapProduct[]> {
  const cleanBase = storeBase.replace(/\/$/, "");
  const now = Date.now();
  if (
    sitemapCache.base === cleanBase &&
    sitemapCache.items.length > 0 &&
    now - sitemapCache.fetchedAt < 30 * 60 * 1000
  ) {
    return sitemapCache.items;
  }

  try {
    const res = await fetch(`${cleanBase}/1_es_0_sitemap.xml`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      cache: "no-store",
    });
    if (!res.ok) return sitemapCache.items;
    const xml = await res.text();
    const blocks = xml.split("<url>");
    const items: SitemapProduct[] = [];

    for (let i = 1; i < blocks.length; i++) {
      const b = blocks[i];
      const loc =
        b.match(/<loc><!\[CDATA\[(.*?)\]\]><\/loc>/)?.[1] ||
        b.match(/<loc>(.*?)<\/loc>/)?.[1] ||
        "";
      if (!loc.endsWith(".html")) continue;

      const idMatch = loc.match(/\/(\d+)(?:-\d+)?-[^/]+\.html$/);
      if (!idMatch) continue;

      const idProduct = idMatch[1];
      const title =
        b.match(/<image:title><!\[CDATA\[(.*?)\]\]><\/image:title>/)?.[1] ||
        loc
          .split("/")
          .pop()!
          .replace(/^\d+-/, "")
          .replace(/\.html$/, "")
          .replace(/-/g, " ");
      const caption =
        b.match(/<image:caption><!\[CDATA\[(.*?)\]\]><\/image:caption>/)?.[1] || "";
      const imageUrl =
        b.match(/<image:loc><!\[CDATA\[(.*?)\]\]><\/image:loc>/)?.[1] || "";

      const searchText = normalizeSearch(`${title} ${caption} ${loc}`);
      items.push({
        idProduct,
        name: title.trim(),
        caption: caption.trim(),
        url: loc.trim(),
        imageUrl: imageUrl.trim(),
        searchText,
        compactText: searchText.replace(/\s+/g, ""),
      });
    }

    sitemapCache.base = cleanBase;
    sitemapCache.fetchedAt = now;
    sitemapCache.items = items;
    return items;
  } catch (err) {
    console.error("Error loading store sitemap:", err);
    return sitemapCache.items;
  }
}

// 1. Analyze customer shoe photo using Gemini Vision (or OpenAI Vision)
export async function analyzeShoePhoto(
  imageBytes: Buffer,
  mimeType: string = "image/jpeg",
  hintText: string = ""
): Promise<VisionAnalysis> {
  const cfg = await getIntegrationSettings();
  const base64 = imageBytes.toString("base64");
  const cleanMime = mimeType.split(";")[0] || "image/jpeg";

  const prompt = `Analiza esta fotografía de un zapato/tenis/bota enviada por un cliente a la tienda El Caminante en Costa Rica (vende tenis deportivas y casuales Joma, Skechers, Nike, Adidas, Puma, Asics, New Balance, Under Armour, Reebok, Umbro, Mizuno, Vans, Converse, botas de seguridad, botas PVC Kayman/Dinosaurio, tacos fútbol, tenis futsal IN/TF).
${hintText ? `Texto o pista adicional del cliente: "${hintText}"` : ""}

Devuelve ÚNICAMENTE un JSON válido (sin markdown ni texto extra):
{
  "brand": "SOLO la marca principal en 1-2 palabras (ej. New Balance, Skechers, Joma, Nike, Adidas, Puma, Asics, Kayman)",
  "modelGuess": "Código numérico o familia exacta del modelo sin colores (ej. 574, 530, 9060, 327, 480, 740, Glide-Step, Bobs Squad, Go Walk, Top Flex, Air Max, Samba, Gazelle, Predator)",
  "shoeType": "Tipo breve (ej. Casual, Running, Futsal IN, Turf TF, Tacos FG, Seguridad, Bota PVC)",
  "colors": ["color principal", "color secundario"],
  "searchQueries": ["Marca + Código/Modelo exacto sin color (ej. New Balance 574)", "Marca + segundo código parecido (ej. New Balance 327)", "Solo la marca (ej. New Balance)"],
  "visualSummary": "Descripción breve en 1 frase del zapato que se ve en la foto"
}
IMPORTANTE: Para New Balance, Adidas, Nike o Asics intenta identificar el número de modelo exacto (ej. 574, 530, 9060, 327, 520, 411, 480, 740). En searchQueries NO pongas colores ni 'Slip-Ins' ni 'para mujer'.`;

  if (cfg.aiApiKey && cfg.aiProvider === "gemini") {
    try {
      const { text: raw, modelUsed } = await callGeminiResilient({
        apiKey: cfg.aiApiKey,
        preferredModel: cfg.aiModel,
        temperature: 0.15,
        maxOutputTokens: 500,
        parts: [
          { text: prompt },
          { inlineData: { mimeType: cleanMime, data: base64 } },
        ],
      });
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const p = JSON.parse(jsonMatch[0]);
        const brand = String(p.brand || "").trim();
        const modelGuess = String(p.modelGuess || "").trim();
        const queries: string[] = [];
        if (brand && modelGuess) queries.push(`${brand} ${modelGuess}`);
        if (Array.isArray(p.searchQueries)) {
          for (const sq of p.searchQueries) {
            const s = String(sq || "").trim();
            if (s && !queries.includes(s)) queries.push(s);
          }
        }
        if (brand && !queries.includes(brand)) queries.push(brand);
        if (hintText.trim() && !queries.includes(hintText.trim())) queries.unshift(hintText.trim());

        return {
          brand,
          modelGuess,
          shoeType: String(p.shoeType || "Calzado"),
          colors: Array.isArray(p.colors) ? p.colors.map(String) : [],
          searchQueries: queries.filter(Boolean),
          visualSummary: String(p.visualSummary || "Foto analizada con Gemini Vision."),
          provider: modelUsed,
        };
      }
    } catch (err) {
      console.error("Gemini Vision shoe analysis error:", err);
    }
  }

  if (cfg.aiApiKey && cfg.aiProvider === "openai") {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.aiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: cfg.aiModel || "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:${cleanMime};base64,${base64}` } },
              ],
            },
          ],
        }),
      });
      const data = await res.json();
      const raw = data?.choices?.[0]?.message?.content || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const p = JSON.parse(jsonMatch[0]);
        return {
          brand: String(p.brand || ""),
          modelGuess: String(p.modelGuess || ""),
          shoeType: String(p.shoeType || "Calzado"),
          colors: Array.isArray(p.colors) ? p.colors.map(String) : [],
          searchQueries:
            Array.isArray(p.searchQueries) && p.searchQueries.length > 0
              ? p.searchQueries.map(String)
              : [hintText || p.brand || ""].filter(Boolean),
          visualSummary: String(p.visualSummary || "Foto analizada con OpenAI Vision."),
          provider: "openai-vision",
        };
      }
    } catch (err) {
      console.error("OpenAI Vision shoe analysis error:", err);
    }
  }

  const fallbackQuery = hintText.trim();
  return {
    brand: "",
    modelGuess: fallbackQuery,
    shoeType: "Calzado",
    colors: [],
    searchQueries: fallbackQuery ? [fallbackQuery] : [],
    visualSummary: fallbackQuery
      ? `Búsqueda directa en tienda web por "${fallbackQuery}".`
      : "No se pudo analizar la imagen automáticamente con Gemini Vision.",
    provider: "vision-unavailable",
  };
}

// 2. Fuzzy & typo-tolerant search across ALL 3,200+ products in elcaminantecr.com/tienda
export async function searchCaminanteStore(
  query: string,
  storeBase: string = DEFAULT_STORE_BASE,
  limit: number = 16,
  footwearOnly: boolean = true
): Promise<StoreCandidate[]> {
  const catalog = await loadSitemapCatalog(storeBase);
  if (catalog.length === 0) return [];

  const normQuery = normalizeSearch(query);
  const rawTokens = normQuery.split(" ").filter((t) => t.length >= 2);
  const cleanTokens = rawTokens.filter((t) => !IGNORE_SEARCH_TOKENS.has(t));
  const tokens = cleanTokens.length > 0 ? cleanTokens : rawTokens;
  if (tokens.length === 0) return [];

  const stems = tokens.map(tokenStem);
  const compactQuery = tokens.join("");

  const scored: Array<{ item: SitemapProduct; score: number }> = [];

  for (const item of catalog) {
    if (footwearOnly && !isLikelyFootwear(item.name)) continue;
    const normTitle = normalizeSearch(item.name);
    const compactTitle = normTitle.replace(/\s+/g, "");
    let score = 0;

    if (compactQuery.length >= 5 && compactTitle.includes(compactQuery)) {
      score += 120;
    }

    let matchedStems = 0;
    for (const st of stems) {
      if (normTitle.includes(st) || compactTitle.includes(st)) {
        score += 28;
        matchedStems++;
      } else if (item.searchText.includes(st) || item.compactText.includes(st)) {
        score += 12;
        matchedStems++;
      }
    }

    if (matchedStems === stems.length) {
      score += 45;
    } else if (stems.length >= 2 && matchedStems === 0) {
      continue;
    }

    if (score >= 22) {
      const recencyBonus = Math.min(10, Number(item.idProduct) / 1500);
      scored.push({ item, score: score + recencyBonus });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ item }) => ({
    idProduct: item.idProduct,
    idProductAttribute: "0",
    name: item.name,
    caption: item.caption,
    price: 0,
    priceText: "Consultar en vivo",
    url: item.url,
    imageUrl: item.imageUrl,
  }));
}

// 3. Visual comparison across up to 14 real store thumbnails (fast home_default!)
export async function pickBestVisualMatch(
  customerImageBytes: Buffer,
  customerMime: string,
  candidates: StoreCandidate[]
): Promise<{
  best: StoreCandidate;
  runnerUp?: StoreCandidate;
  confidence: number;
  reason: string;
} | null> {
  if (candidates.length === 0) return null;

  const cfg = await getIntegrationSettings();
  if (!cfg.aiApiKey || cfg.aiProvider !== "gemini") {
    return {
      best: candidates[0],
      runnerUp: candidates[1],
      confidence: 78,
      reason: "Coincidencia principal en elcaminantecr.com/tienda.",
    };
  }

  try {
    // Load up to 24 lightweight home_default store thumbnails in parallel (~400ms!)
    const pool = candidates.slice(0, 24);
    const loaded = (
      await Promise.all(
        pool.map(async (c) => {
          if (!c.imageUrl) return null;
          const thumbUrl = toThumbnailUrl(c.imageUrl);
          try {
            let imgRes = await fetch(thumbUrl);
            if (!imgRes.ok) imgRes = await fetch(c.imageUrl);
            if (!imgRes.ok) return null;
            const buf = Buffer.from(await imgRes.arrayBuffer());
            const ct = imgRes.headers.get("content-type") || "image/jpeg";
            return { candidate: c, buf, mime: ct.split(";")[0] || "image/jpeg" };
          } catch {
            return null;
          }
        })
      )
    ).filter((x): x is NonNullable<typeof x> => x !== null);

    if (loaded.length === 0) {
      return { best: candidates[0], confidence: 70, reason: "Coincidencia por texto en tienda." };
    }

    const compareBatch = async (batch: typeof loaded) => {
      const parts: Array<Record<string, unknown>> = [
        {
          text: `Eres experto reconociendo modelos exactos de calzado deportivo y casual.
La PRIMERA imagen es la foto enviada por el cliente (puede estar tomada con celular en una tienda o en mano).
Las siguientes ${batch.length} imágenes numeradas (Opción #1 a Opción #${batch.length}) son fotos oficiales de catálogo de nuestra tienda El Caminante.

Compara cuidadosamente:
1) Forma y dibujo de la suela (ej. perforaciones geométricas Glide-Step, suela retro New Balance, tacos TF, suela lisa IN).
2) Color principal de la malla/gamuza y color del logo/suela/talón.
3) Diseño lateral del logo y costuras.

Reglas de calificación:
- Si una opción coincide en modelo Y color (o casi idéntico), pon confidence entre 80 y 99.
- Si coincide en la misma línea/silueta pero varía ligeramente el tono/versión, pon confidence entre 55 y 79 y sugiere runnerUpIndex con la segunda mejor opción.
- Solo pon bestIndex: 0 si NINGUNA opción se parece al zapato del cliente.

Devuelve ÚNICAMENTE JSON válido sin texto extra:
{"bestIndex": 1, "runnerUpIndex": 2, "confidence": 88, "reason": "Coincide silueta, logo y color"}`,
        },
        {
          inlineData: {
            mimeType: customerMime.split(";")[0] || "image/jpeg",
            data: customerImageBytes.toString("base64"),
          },
        },
      ];

      batch.forEach((item, idx) => {
        parts.push({ text: `Opción #${idx + 1}: ${item.candidate.name}` });
        parts.push({
          inlineData: { mimeType: item.mime, data: item.buf.toString("base64") },
        });
      });

      const { text: raw } = await callGeminiResilient({
        apiKey: cfg.aiApiKey,
        preferredModel: cfg.aiModel,
        temperature: 0.1,
        maxOutputTokens: 300,
        parts,
      });

      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return null;
      const parsed = JSON.parse(m[0]);
      const rawIdx = Number(parsed.bestIndex);
      const conf = Number(parsed.confidence) || 0;
      if (rawIdx === 0 || (conf > 0 && conf < 40)) return null;

      const idx = Math.max(0, Math.min(batch.length - 1, (rawIdx || 1) - 1));
      const rawRunner = Number(parsed.runnerUpIndex) || 0;
      const runnerUp =
        rawRunner >= 1 && rawRunner <= batch.length && rawRunner - 1 !== idx
          ? batch[rawRunner - 1].candidate
          : undefined;

      return {
        best: batch[idx].candidate,
        runnerUp,
        confidence: conf || 85,
        reason: String(parsed.reason || "Coincidencia visual confirmada con Gemini Vision."),
      };
    };

    // Round 1: check top 12 candidates
    const round1 = await compareBatch(loaded.slice(0, 12));
    if (round1 && round1.confidence >= 80) {
      return round1;
    }

    // Round 2: if brand had >12 shoes and Round 1 wasn't a slam dunk, check shoes #13-#24!
    if (loaded.length > 12) {
      const round2 = await compareBatch(loaded.slice(12, 24));
      if (round2 && (!round1 || round2.confidence > round1.confidence)) {
        return round2;
      }
    }

    return round1;
  } catch (err) {
    console.error("Visual reranking error:", err);
  }

  return null;
}

// 4. Fetch live product details, ALL sizes (Tallas) and per-branch stock (Ciudad Quesada, La Fortuna, Online)!
export async function fetchLiveShoeDetailsAndSizes(
  candidate: StoreCandidate,
  storeBase: string = DEFAULT_STORE_BASE
): Promise<EnrichedShoeProduct> {
  const cleanBase = storeBase.replace(/\/$/, "");
  let name = candidate.name;
  let sku = candidate.sku || "";
  let brand = candidate.brand || "";
  let price = candidate.price;
  let description = "";
  let imageUrl = candidate.imageUrl;
  let finalUrl = candidate.url;
  const colors: string[] = [];
  const sizes: SizeStock[] = [];

  try {
    const pageRes = await fetch(candidate.url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      cache: "no-store",
    });
    finalUrl = pageRes.url || candidate.url;

    const cookiesHeader = pageRes.headers.get("set-cookie") || "";
    const cookieJar = cookiesHeader
      .split(/,(?=[^;]+=[^;]+)/)
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");

    const html = await pageRes.text();

    const ldBlocks =
      html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const block of ldBlocks) {
      const inner = block.replace(/<script[^>]*>|<\/script>/gi, "").trim();
      try {
        const parsed = JSON.parse(inner);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const obj of items) {
          if (obj["@type"] === "Product") {
            if (obj.name) name = String(obj.name);
            if (obj.sku || obj.mpn) sku = String(obj.sku || obj.mpn);
            if (obj.brand?.name) brand = String(obj.brand.name);
            if (obj.description) description = stripHtml(String(obj.description)).slice(0, 300);
            if (obj.image) {
              imageUrl = Array.isArray(obj.image) ? String(obj.image[0]) : String(obj.image);
            }
            const offer = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
            if (offer?.price) price = Number(offer.price) || price;
          }
        }
      } catch {
        // Ignore malformed JSON-LD
      }
    }

    const tokenMatch =
      html.match(/name=["']token["'][^>]*value=["']([a-f0-9]+)["']/i) ||
      html.match(/"static_token"\s*:\s*"([a-f0-9]+)"/i);
    const csrfToken = tokenMatch?.[1] || "";

    const groupEntries: Array<{ groupId: string; value: string; label: string; checked: boolean }> = [];
    const inputRegex = /<input[^>]*name=["']group\[(\d+)\]["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = inputRegex.exec(html)) !== null) {
      const tag = m[0];
      const groupId = m[1];
      const valMatch = tag.match(/value=["'](\d+)["']/i);
      if (!valMatch) continue;
      const value = valMatch[1];
      const checked = /checked/i.test(tag);
      const after = html.slice(m.index + tag.length, m.index + tag.length + 220);
      const labelMatch =
        after.match(/<span[^>]*class=["'][^"']*(?:radio-label|sr-only)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ||
        tag.match(/title=["']([^"']+)["']/i);
      const label = labelMatch?.[1] ? stripHtml(labelMatch[1]) : value;
      groupEntries.push({ groupId, value, label, checked });
    }

    const selectRegex = /<select[^>]*name=["']group\[(\d+)\]["'][^>]*>([\s\S]*?)<\/select>/gi;
    while ((m = selectRegex.exec(html)) !== null) {
      const groupId = m[1];
      const optRegex = /<option[^>]*value=["'](\d+)["'][^>]*>([\s\S]*?)<\/option>/gi;
      let om: RegExpExecArray | null;
      while ((om = optRegex.exec(m[2])) !== null) {
        groupEntries.push({
          groupId,
          value: om[1],
          label: stripHtml(om[2]),
          checked: /selected/i.test(om[0]),
        });
      }
    }

    const grouped = new Map<string, typeof groupEntries>();
    for (const entry of groupEntries) {
      if (!grouped.has(entry.groupId)) grouped.set(entry.groupId, []);
      grouped.get(entry.groupId)!.push(entry);
    }

    let sizeGroupId = "";
    let colorGroupId = "";
    let defaultColorVal = "";

    for (const [gid, entries] of grouped.entries()) {
      const numericRatio =
        entries.filter((e) => /^\d+(\.\d+)?(\s*-\s*\d+)?$|^(xs|s|m|l|xl|xxl)$/i.test(e.label.trim())).length /
        Math.max(1, entries.length);
      if (numericRatio >= 0.5 && !sizeGroupId) {
        sizeGroupId = gid;
      } else if (!colorGroupId) {
        colorGroupId = gid;
        const checkedColor = entries.find((e) => e.checked) || entries[0];
        defaultColorVal = checkedColor?.value || "";
        for (const e of entries) colors.push(e.label);
      }
    }

    const sizeOptions = sizeGroupId ? grouped.get(sizeGroupId) || [] : [];

    const fetchBranchStock = async (idProd: string, idAttr: string) => {
      try {
        const avUrl = `${cleanBase}/module/elcaminante_branchpickup/availability?id_product=${encodeURIComponent(
          idProd
        )}&id_product_attribute=${encodeURIComponent(idAttr)}`;
        const avRes = await fetch(avUrl, { cache: "no-store" });
        if (!avRes.ok) return { quesada: 0, fortuna: 0, online: 0 };
        const avJson = await avRes.json();
        return {
          quesada: Number(avJson?.stock?.quesada) || 0,
          fortuna: Number(avJson?.stock?.fortuna) || 0,
          online: Number(avJson?.stock?.online) || 0,
        };
      } catch {
        return { quesada: 0, fortuna: 0, online: 0 };
      }
    };

    if (sizeOptions.length > 0 && csrfToken) {
      await Promise.all(
        sizeOptions.slice(0, 14).map(async (opt) => {
          let attrId = "";
          try {
            const params = new URLSearchParams({
              controller: "product",
              token: csrfToken,
              id_product: candidate.idProduct,
              id_customization: "0",
              qty: "1",
              ajax: "1",
              action: "refresh",
            });
            params.set(`group[${sizeGroupId}]`, opt.value);
            if (colorGroupId && defaultColorVal) {
              params.set(`group[${colorGroupId}]`, defaultColorVal);
            }
            const refRes = await fetch(`${cleanBase}/index.php?${params.toString()}`, {
              method: "POST",
              headers: {
                Accept: "application/json, text/javascript, */*; q=0.01",
                "X-Requested-With": "XMLHttpRequest",
                ...(cookieJar ? { Cookie: cookieJar } : {}),
              },
              cache: "no-store",
            });
            if (refRes.ok) {
              const refJson = await refRes.json();
              if (refJson.id_product_attribute) {
                attrId = String(refJson.id_product_attribute);
              } else if (refJson.product_url) {
                const um = String(refJson.product_url).match(/\/(\d+)-(\d+)-/);
                if (um?.[2]) attrId = um[2];
              }
            }
          } catch {
            // Ignore single variant error
          }

          if (attrId) {
            const st = await fetchBranchStock(candidate.idProduct, attrId);
            sizes.push({
              size: opt.label,
              attributeId: attrId,
              quesada: st.quesada,
              fortuna: st.fortuna,
              online: st.online,
              totalAvailable: st.quesada + st.fortuna + st.online,
            });
          } else {
            sizes.push({
              size: opt.label,
              attributeId: "",
              quesada: 0,
              fortuna: 0,
              online: 0,
              totalAvailable: 0,
            });
          }
        })
      );

      sizes.sort((a, b) => {
        const na = parseFloat(a.size);
        const nb = parseFloat(b.size);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.size.localeCompare(b.size);
      });
    }
  } catch (err) {
    console.error("Error fetching live shoe details:", err);
  }

  const inStockTotal = sizes.reduce((acc, s) => acc + s.totalAvailable, 0);

  return {
    ...candidate,
    url: finalUrl,
    name,
    sku: sku || `WEB-${candidate.idProduct}`,
    brand,
    price,
    priceText: price > 0 ? formatMoney(price, "CRC") : "Consultar",
    description,
    imageUrl,
    colors,
    sizes,
    inStockTotal,
  };
}

// 5. Full End-to-End Orchestrator
export async function identifyShoeAndFetchLiveStock(params: {
  imageBytes?: Buffer;
  mimeType?: string;
  hintText?: string;
  candidateUrl?: string;
  storeBase?: string;
}) {
  const storeBase = params.storeBase || DEFAULT_STORE_BASE;
  let vision: VisionAnalysis;

  if (params.imageBytes && params.imageBytes.length > 0 && !params.candidateUrl) {
    vision = await analyzeShoePhoto(params.imageBytes, params.mimeType, params.hintText);
  } else {
    const q = (params.hintText || "Joma Top Flex").trim();
    vision = {
      brand: "",
      modelGuess: q,
      shoeType: "Calzado",
      colors: [],
      searchQueries: [q],
      visualSummary: `Búsqueda en catálogo oficial de elcaminantecr.com/tienda por "${q}".`,
      provider: "catalog-search",
    };
  }

  // Gather up to 24 footwear candidates across all vision search queries
  const candidateMap = new Map<string, StoreCandidate>();
  for (const q of vision.searchQueries.slice(0, 4)) {
    if (!q.trim()) continue;
    const found = await searchCaminanteStore(q.trim(), storeBase, 24);
    for (const c of found) {
      if (!candidateMap.has(c.idProduct)) candidateMap.set(c.idProduct, c);
    }
    if (candidateMap.size >= 24) break;
  }

  const localMatches = await prisma.product.findMany({
    where: {
      active: true,
      OR: vision.searchQueries.slice(0, 2).map((q) => ({ name: { contains: q.split(" ")[0] } })),
    },
    take: 3,
  });

  const candidates = Array.from(candidateMap.values());
  let bestMatch: EnrichedShoeProduct | null = null;
  let runnerUpMatch: EnrichedShoeProduct | null = null;
  let matchConfidence = 0;
  let matchReason = "";

  if (params.candidateUrl) {
    const explicit = candidates.find((c) => c.url === params.candidateUrl);
    if (explicit) {
      matchConfidence = 100;
      matchReason = "Modelo seleccionado manualmente.";
      bestMatch = await fetchLiveShoeDetailsAndSizes(explicit, storeBase);
    }
  }

  if (!bestMatch && candidates.length > 0) {
    const picked =
      params.imageBytes && params.imageBytes.length > 0
        ? await pickBestVisualMatch(params.imageBytes, params.mimeType || "image/jpeg", candidates)
        : {
            best: candidates[0],
            runnerUp: undefined,
            confidence: 88,
            reason: "Coincidencia directa en elcaminantecr.com/tienda.",
          };

    if (picked) {
      matchConfidence = picked.confidence;
      matchReason = picked.reason;
      bestMatch = await fetchLiveShoeDetailsAndSizes(picked.best, storeBase);
      if (picked.runnerUp && matchConfidence < 80) {
        runnerUpMatch = await fetchLiveShoeDetailsAndSizes(picked.runnerUp, storeBase);
      }
    }
  }

  const cfg = await getIntegrationSettings();
  const renderTpl = (tpl: string, vars: Record<string, string>) =>
    tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");

  let whatsappReply = "";
  if (bestMatch) {
    const availableSizes = bestMatch.sizes.filter((s) => s.totalAvailable > 0);
    const sizeLines =
      availableSizes.length > 0
        ? availableSizes
            .map((s) => {
              const branches: string[] = [];
              if (s.quesada > 0) branches.push(`Ciudad Quesada: ${s.quesada}`);
              if (s.fortuna > 0) branches.push(`La Fortuna: ${s.fortuna}`);
              if (s.online > 0) branches.push(`Online: ${s.online}`);
              return `• Talla *${s.size}* — Disponible (${branches.join(" | ")})`;
            })
            .join("\n")
        : bestMatch.sizes.length > 0
        ? `• Tallas publicadas: ${bestMatch.sizes.map((s) => s.size).join(", ")} (consultar existencia inmediata)`
        : "• Disponible en tienda (confirmar talla deseada)";

    const intro =
      matchConfidence >= 78
        ? "Identificamos este modelo en nuestra tienda:"
        : "Este es el modelo más parecido que encontramos en nuestra tienda (confírmame si es exactamente el que buscas):";

    const altBlock = runnerUpMatch
      ? `\n\n🔎 *Otra opción muy parecida:*\n*${runnerUpMatch.name}* — ${formatMoney(
          runnerUpMatch.price,
          "CRC"
        )} (${runnerUpMatch.url})`
      : "";

    if (cfg.visionFoundTemplate && cfg.visionFoundTemplate.trim()) {
      whatsappReply = renderTpl(cfg.visionFoundTemplate, {
        modelo: bestMatch.name,
        sku: bestMatch.sku || "",
        precio: formatMoney(bestMatch.price, "CRC"),
        tallas: sizeLines,
        enlace: bestMatch.url,
        alternativa: altBlock,
        resumen: vision.visualSummary,
      });
    } else {
      whatsappReply = `¡Hola! Gracias por enviarnos la foto 👟\n\n${intro}\n*${bestMatch.name}*${
        bestMatch.sku ? ` (Ref: ${bestMatch.sku})` : ""
      }\n💰 *Precio:* ${formatMoney(bestMatch.price, "CRC")} (IVA 13% incluido)\n\n📏 *Tallas disponibles en vivo:*\n${sizeLines}\n\n🔗 Ver en tienda: ${bestMatch.url}${altBlock}\n\n¿Qué talla necesitas para apartártelo o enviarte la Factura Proforma? (SINPE Móvil 8691-1975).`;
    }
  } else {
    if (cfg.visionFallbackTemplate && cfg.visionFallbackTemplate.trim()) {
      whatsappReply = renderTpl(cfg.visionFallbackTemplate, {
        resumen: vision.visualSummary,
      });
    } else {
      whatsappReply = `¡Hola! Recibimos tu foto (${vision.visualSummary}). No encontré ese colorway exacto publicado en la tienda web en este momento, pero ya pasé tu imagen a un asesor de Caminante Corporativo para revisarte bodega y confirmarte tallas y precio enseguida. ¿Qué talla buscas?`;
    }
  }

  return {
    vision,
    bestMatch,
    matchConfidence,
    matchReason,
    candidates: candidates.slice(0, 8),
    localMatches,
    whatsappReply,
  };
}

export async function downloadMetaWhatsAppImage(mediaId: string): Promise<{
  bytes: Buffer;
  mimeType: string;
} | null> {
  const cfg = await getIntegrationSettings();
  if (!cfg.metaAccessToken || !mediaId) return null;
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${cfg.metaAccessToken}` },
    });
    const metaJson = await metaRes.json();
    if (!metaRes.ok || !metaJson.url) return null;
    const imgRes = await fetch(metaJson.url, {
      headers: { Authorization: `Bearer ${cfg.metaAccessToken}` },
    });
    if (!imgRes.ok) return null;
    const bytes = Buffer.from(await imgRes.arrayBuffer());
    return {
      bytes,
      mimeType: metaJson.mime_type || imgRes.headers.get("content-type") || "image/jpeg",
    };
  } catch (err) {
    console.error("Meta image download error:", err);
    return null;
  }
}
