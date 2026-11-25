import { getIntegrationSettings } from "./prisma";
import { callGeminiResilient } from "./gemini";

export async function transcribeAudioBuffer(
  audioBytes: Buffer,
  mimeType: string = "audio/ogg",
  fallbackText?: string
): Promise<{ transcript: string; provider: string }> {
  const cfg = await getIntegrationSettings();

  // 1. Google Gemini Multimodal Audio Transcription (OGG/OPUS from WhatsApp, MP3, WAV, M4A)
  if (cfg.aiApiKey && cfg.aiProvider === "gemini") {
    try {
      const base64 = audioBytes.toString("base64");
      const cleanMime = mimeType.split(";")[0].trim() || "audio/ogg";
      const { text, modelUsed } = await callGeminiResilient({
        apiKey: cfg.aiApiKey,
        preferredModel: cfg.aiModel,
        temperature: 0.1,
        maxOutputTokens: 600,
        parts: [
          {
            text: "Transcribe fielmente este audio de un cliente de WhatsApp en español. Devuelve únicamente las palabras exactas que dijo la persona, sin explicaciones ni comillas extra.",
          },
          {
            inlineData: {
              mimeType: cleanMime,
              data: base64,
            },
          },
        ],
      });
      if (text) return { transcript: text, provider: modelUsed };
    } catch (err) {
      console.error("Gemini audio transcription error:", err);
    }
  }

  // 2. OpenAI Whisper Transcription
  if (cfg.aiApiKey && cfg.aiProvider === "openai") {
    try {
      const formData = new FormData();
      const ext =
        mimeType.includes("mp3") || mimeType.includes("mpeg")
          ? "mp3"
          : mimeType.includes("wav")
          ? "wav"
          : "ogg";
      formData.append(
        "file",
        new Blob([new Uint8Array(audioBytes)], { type: mimeType }),
        `audio.${ext}`
      );
      formData.append("model", "whisper-1");
      formData.append("language", "es");

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.aiApiKey}` },
        body: formData,
      });
      const data = await res.json();
      if (data?.text) return { transcript: String(data.text).trim(), provider: "openai-whisper" };
    } catch (err) {
      console.error("Whisper transcription error:", err);
    }
  }

  return {
    transcript:
      fallbackText ||
      "[No se pudo transcribir la nota de voz en este momento — revisa el audio directamente o la API Key en Conexiones]",
    provider: "audio-error",
  };
}

export async function downloadAndTranscribeMetaAudio(mediaId: string): Promise<{
  transcript: string;
  provider: string;
}> {
  const cfg = await getIntegrationSettings();
  if (!cfg.metaAccessToken || !mediaId) {
    return {
      transcript: "[Audio de WhatsApp recibido — falta Token de Meta para descargar el archivo]",
      provider: "missing-meta-token",
    };
  }

  try {
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${cfg.metaAccessToken}` },
    });
    const metaJson = await metaRes.json();
    if (!metaRes.ok || !metaJson.url) {
      return { transcript: "[No se pudo obtener URL del audio de WhatsApp]", provider: "error" };
    }

    const fileRes = await fetch(metaJson.url, {
      headers: { Authorization: `Bearer ${cfg.metaAccessToken}` },
    });
    const arrayBuf = await fileRes.arrayBuffer();
    const mimeType = metaJson.mime_type || fileRes.headers.get("content-type") || "audio/ogg";

    return transcribeAudioBuffer(Buffer.from(arrayBuf), mimeType);
  } catch (err) {
    console.error("Meta audio download error:", err);
    return { transcript: "[Error descargando nota de voz de WhatsApp]", provider: "error" };
  }
}
