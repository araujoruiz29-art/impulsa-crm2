// Resilient Google Gemini caller with automatic fallback across available Flash models
// Handles 404 (deprecated model) and 503 (temporary high demand spike) automatically.

const FALLBACK_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
];

export interface GeminiCallInput {
  apiKey: string;
  preferredModel?: string;
  systemInstruction?: string;
  parts: Array<Record<string, unknown>>;
  temperature?: number;
  maxOutputTokens?: number;
}

export async function callGeminiResilient(input: GeminiCallInput): Promise<{
  text: string;
  modelUsed: string;
}> {
  const candidates: string[] = [];
  const pref = (input.preferredModel || "").trim();

  // Skip known deprecated gemini-2.5-flash for new accounts so we don't waste a round-trip
  if (pref && pref !== "gemini-2.5-flash") {
    candidates.push(pref);
  }
  for (const m of FALLBACK_MODELS) {
    if (!candidates.includes(m)) candidates.push(m);
  }

  let lastError = "No se pudo conectar con Gemini API.";

  for (const model of candidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(input.apiKey)}`;

      const payload: Record<string, unknown> = {
        contents: [{ role: "user", parts: input.parts }],
        generationConfig: {
          temperature: input.temperature ?? 0.35,
          maxOutputTokens: input.maxOutputTokens ?? 900,
        },
      };
      if (input.systemInstruction) {
        payload.systemInstruction = { parts: [{ text: input.systemInstruction }] };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18000);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        lastError = `[${model}] ${msg}`;
        // Backoff briefly on 429 rate-limit before trying next model
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 1200));
        }
        // Retry next model on 404, 429, 500, 503
        if ([404, 429, 500, 503].includes(res.status)) {
          continue;
        }
        throw new Error(lastError);
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) {
        return { text, modelUsed: model };
      }
      lastError = `[${model}] Respuesta vacía.`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(lastError);
}
