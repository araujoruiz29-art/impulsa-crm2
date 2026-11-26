"use client";

import React, { useRef, useState } from "react";
import {
  Film,
  Upload,
  Sparkles,
  Download,
  Trash2,
  Copy,
  Package,
  Music,
  CheckCircle2,
  Loader2,
  ArrowUp,
  ArrowDown,
  Camera,
} from "lucide-react";

interface SlidePhoto {
  id: string;
  url: string;
  name: string;
  caption: string;
}

interface ReelAiPlan {
  hook: string;
  priceBadge: string;
  ctaKeyword: string;
  ctaText: string;
  slideCaptions: string[];
  socialCaption: string;
  hashtags: string;
  cinematicAiPrompt: string;
}

interface PhotoReelStudioProps {
  brandName?: string;
  onNotify?: (msg: string) => void;
  onError?: (msg: string) => void;
}

type VisualTheme = "viral" | "flash" | "boutique";

const THEME_PALETTES: Record<
  VisualTheme,
  { name: string; primary: string; accent: string; badgeBg: string; badgeText: string }
> = {
  viral: {
    name: "🔥 Viral Moderno",
    primary: "#1e1046",
    accent: "#f95599",
    badgeBg: "#fde047",
    badgeText: "#1e1046",
  },
  flash: {
    name: "🏷️ Oferta Flash",
    primary: "#991b1b",
    accent: "#f97316",
    badgeBg: "#fef08a",
    badgeText: "#7f1d1d",
  },
  boutique: {
    name: "✨ Elegante Boutique",
    primary: "#0f172a",
    accent: "#0ea5e9",
    badgeBg: "#ffffff",
    badgeText: "#0f172a",
  },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar una imagen."));
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

export function PhotoReelStudio({ brandName = "impulsa CRM", onNotify, onError }: PhotoReelStudioProps) {
  const [photos, setPhotos] = useState<SlidePhoto[]>([]);
  const [productTitle, setProductTitle] = useState("");
  const [hookText, setHookText] = useState("");
  const [priceBadge, setPriceBadge] = useState("");
  const [ctaText, setCtaText] = useState("👇 Comenta «PRECIO» y te enviamos DM");
  const [format, setFormat] = useState<"vertical" | "horizontal">("vertical");
  const [onlyPhotosMode, setOnlyPhotosMode] = useState(true);
  const [theme, setTheme] = useState<VisualTheme>("viral");
  const [secPerPhoto, setSecPerPhoto] = useState(2.2);
  const [includeMusic, setIncludeMusic] = useState(true);

  const [planning, setPlanning] = useState(false);
  const [aiPlan, setAiPlan] = useState<ReelAiPlan | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState("webm");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) {
      onError?.("Selecciona archivos de imagen (JPG, PNG o WebP).");
      return;
    }

    const remaining = Math.max(0, 12 - photos.length);
    const toRead = incoming.slice(0, remaining);

    toRead.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setPhotos((prev) => [
            ...prev,
            {
              id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              url: reader.result as string,
              name: file.name.replace(/\.[^.]+$/, ""),
              caption: "",
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const loadFromCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const withImages = (data.products || []).filter((p: any) => p.imageUrl && String(p.imageUrl).trim());
      if (withImages.length === 0) {
        onError?.("Tu Catálogo todavía no tiene productos con foto cargada. Sube fotos desde tu compu o celular aquí mismo.");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const picked: SlidePhoto[] = withImages.slice(0, 6).map((p: any) => ({
        id: `cat_${p.id}`,
        url: p.imageUrl,
        name: p.name,
        caption: p.price ? `${p.name} · ₡${Number(p.price).toLocaleString("es-CR")}` : p.name,
      }));
      setPhotos((prev) => [...prev, ...picked].slice(0, 12));
      if (!productTitle && picked[0]) {
        setProductTitle(picked[0].name);
      }
      onNotify?.(`📦 Se agregaron ${picked.length} fotos de tu Catálogo al Creador de Reels.`);
    } catch {
      onError?.("No se pudo leer el Catálogo ahorita.");
    } finally {
      setLoadingCatalog(false);
    }
  };

  const movePhoto = (index: number, dir: -1 | 1) => {
    setPhotos((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const generateAiPlan = async () => {
    const topic = productTitle.trim() || photos.map((p) => p.name).join(", ") || "Productos en promoción";
    setPlanning(true);
    try {
      const res = await fetch("/api/meta/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "photo_reel_plan",
          product: topic,
          photoCount: Math.max(3, photos.length),
          priceOrOffer: priceBadge.trim(),
          format,
          onlyPhotosMode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.plan) {
        throw new Error(data.error || "La IA no pudo crear el plan ahorita.");
      }
      const plan: ReelAiPlan = data.plan;
      setAiPlan(plan);
      setHookText(plan.hook || hookText);
      if (plan.priceBadge && !priceBadge) setPriceBadge(plan.priceBadge);
      if (plan.ctaText) setCtaText(plan.ctaText);
      if (Array.isArray(plan.slideCaptions) && photos.length > 0) {
        setPhotos((prev) =>
          prev.map((p, idx) => ({
            ...p,
            caption: plan.slideCaptions[idx] || p.caption || plan.slideCaptions[idx % plan.slideCaptions.length] || "",
          }))
        );
      }
      onNotify?.("✨ La IA generó tu Prompt Cinematográfico (estilo Shorty/Veo/Kling), caption y textos por foto.");
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Error generando sugerencias con IA.");
    } finally {
      setPlanning(false);
    }
  };

  const generateReelVideo = async () => {
    if (photos.length < 2) {
      onError?.("Sube al menos 2 fotos (ideal 4 a 8) para crear un Video Reel fluido.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      onError?.("Tu navegador no soporta grabación de video local. Usa Google Chrome o Edge actualizado.");
      return;
    }

    setRendering(true);
    setRenderProgress(0);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    let audioCtx: AudioContext | null = null;
    try {
      const loadedImages = await Promise.all(photos.map((p) => loadImage(p.url)));
      const W = format === "vertical" ? 720 : 1280;
      const H = format === "vertical" ? 1280 : 720;
      const FPS = 30;
      const totalSec = photos.length * secPerPhoto;
      const totalFrames = Math.ceil(totalSec * FPS);
      const pal = THEME_PALETTES[theme];

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo inicializar el lienzo de video.");

      const canvasStream = canvas.captureStream(FPS);
      const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

      // Optional synthesized upbeat commercial music via WebAudio (100% royalty-free)
      if (includeMusic && typeof AudioContext !== "undefined") {
        audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        const master = audioCtx.createGain();
        master.gain.setValueAtTime(0.16, audioCtx.currentTime);
        master.connect(dest);

        const chords = [
          [261.63, 329.63, 392.0],
          [220.0, 261.63, 329.63],
          [174.61, 220.0, 261.63],
          [196.0, 246.94, 293.66],
        ];
        const beat = 0.5; // 120 BPM
        const now = audioCtx.currentTime + 0.05;

        for (let b = 0; b < Math.ceil(totalSec / beat); b++) {
          const t0 = now + b * beat;
          const chord = chords[Math.floor(b / 4) % chords.length];

          // Soft warm pulse kick every beat
          const kickOsc = audioCtx.createOscillator();
          const kickGain = audioCtx.createGain();
          kickOsc.type = "sine";
          kickOsc.frequency.setValueAtTime(125, t0);
          kickOsc.frequency.exponentialRampToValueAtTime(46, t0 + 0.11);
          kickGain.gain.setValueAtTime(0.32, t0);
          kickGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
          kickOsc.connect(kickGain);
          kickGain.connect(master);
          kickOsc.start(t0);
          kickOsc.stop(t0 + 0.15);

          // Chord pad on bar start
          if (b % 4 === 0) {
            for (const freq of chord) {
              const osc = audioCtx.createOscillator();
              const g = audioCtx.createGain();
              osc.type = "triangle";
              osc.frequency.setValueAtTime(freq, t0);
              g.gain.setValueAtTime(0.001, t0);
              g.gain.linearRampToValueAtTime(0.12, t0 + 0.18);
              g.gain.linearRampToValueAtTime(0.08, t0 + beat * 3.6);
              g.gain.linearRampToValueAtTime(0.001, t0 + beat * 4);
              osc.connect(g);
              g.connect(master);
              osc.start(t0);
              osc.stop(t0 + beat * 4 + 0.02);
            }
          }
        }
        tracks.push(...dest.stream.getAudioTracks());
      }

      const mixedStream = new MediaStream(tracks);
      const mimeCandidates = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const chosenMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
      setVideoExt(chosenMime.includes("mp4") ? "mp4" : "webm");

      const recorder = new MediaRecorder(mixedStream, {
        ...(chosenMime ? { mimeType: chosenMime } : {}),
        videoBitsPerSecond: 4_500_000,
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: chosenMime || "video/webm" }));
      });

      const drawPhotoSlide = (img: HTMLImageElement, slideIdx: number, localP: number, alpha: number) => {
        ctx.save();
        ctx.globalAlpha = alpha;

        // 1. Ambient dark/blurred cover background
        const bgScale = Math.max(W / img.width, H / img.height) * 1.12;
        const bgW = img.width * bgScale;
        const bgH = img.height * bgScale;
        ctx.filter = "blur(24px) brightness(0.45)";
        ctx.drawImage(img, (W - bgW) / 2, (H - bgH) / 2, bgW, bgH);
        ctx.filter = "none";

        // 2. Smooth alternating Ken Burns motion on hero photo
        const zoomIn = slideIdx % 2 === 0;
        const scaleFactor = zoomIn ? 1.0 + localP * 0.11 : 1.11 - localP * 0.11;
        const panX = (slideIdx % 2 === 0 ? 1 : -1) * (localP - 0.5) * (W * 0.045);

        const fitScale = Math.max(W / img.width, H / img.height);
        const drawW = img.width * fitScale * scaleFactor;
        const drawH = img.height * fitScale * scaleFactor;
        ctx.drawImage(img, (W - drawW) / 2 + panX, (H - drawH) / 2, drawW, drawH);

        // 3. Top & bottom readability gradients (only in commercial text mode)
        if (!onlyPhotosMode) {
          const topGrad = ctx.createLinearGradient(0, 0, 0, H * 0.34);
          topGrad.addColorStop(0, "rgba(10, 6, 26, 0.82)");
          topGrad.addColorStop(1, "rgba(10, 6, 26, 0)");
          ctx.fillStyle = topGrad;
          ctx.fillRect(0, 0, W, H * 0.34);

          const botGrad = ctx.createLinearGradient(0, H * 0.58, 0, H);
          botGrad.addColorStop(0, "rgba(10, 6, 26, 0)");
          botGrad.addColorStop(1, "rgba(10, 6, 26, 0.92)");
          ctx.fillStyle = botGrad;
          ctx.fillRect(0, H * 0.58, W, H * 0.42);
        }

        ctx.restore();
      };

      recorder.start(150);

      const startWall = performance.now();
      for (let f = 0; f < totalFrames; f++) {
        const t = f / FPS;
        const slideIdx = Math.min(photos.length - 1, Math.floor(t / secPerPhoto));
        const localT = t - slideIdx * secPerPhoto;
        const localP = Math.min(1, Math.max(0, localT / secPerPhoto));

        ctx.fillStyle = pal.primary;
        ctx.fillRect(0, 0, W, H);

        // Crossfade from previous photo during first 0.35s of each slide
        const fadeDur = 0.35;
        if (slideIdx > 0 && localT < fadeDur) {
          const blend = localT / fadeDur;
          drawPhotoSlide(loadedImages[slideIdx - 1], slideIdx - 1, 1, 1);
          drawPhotoSlide(loadedImages[slideIdx], slideIdx, localP, blend);
        } else {
          drawPhotoSlide(loadedImages[slideIdx], slideIdx, localP, 1);
        }

        // Commercial Overlays (skipped in Clean Photo-Only Cinematic Mode!)
        if (!onlyPhotosMode) {
          const padX = format === "vertical" ? 36 : 52;
          ctx.save();
          ctx.font = `800 ${format === "vertical" ? 24 : 26}px "Segoe UI", system-ui, sans-serif`;
          const bText = `★ ${brandName.toUpperCase()}`;
          const bWidth = ctx.measureText(bText).width + 40;
          drawRoundedRect(ctx, padX, 38, bWidth, 48, 24);
          ctx.fillStyle = "rgba(15, 10, 40, 0.72)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.28)";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = "#ffffff";
          ctx.fillText(bText, padX + 20, 70);

          // Slide counter badge (top-right)
          const counterTxt = `${slideIdx + 1}/${photos.length}`;
          const cWidth = ctx.measureText(counterTxt).width + 30;
          drawRoundedRect(ctx, W - padX - cWidth, 38, cWidth, 48, 24);
          ctx.fillStyle = pal.accent;
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.fillText(counterTxt, W - padX - cWidth + 15, 70);

          // Hook / Main Headline (top area)
          const activeHook = (hookText.trim() || productTitle.trim() || "NUEVA COLECCIÓN").toUpperCase();
          ctx.font = `900 ${format === "vertical" ? 44 : 48}px "Segoe UI", system-ui, sans-serif`;
          const hookLines = wrapLines(ctx, activeHook, W - padX * 2, 2);
          ctx.textAlign = "center";
          hookLines.forEach((line, li) => {
            const y = (format === "vertical" ? 158 : 146) + li * (format === "vertical" ? 54 : 56);
            ctx.lineWidth = 8;
            ctx.strokeStyle = "rgba(10, 6, 26, 0.85)";
            ctx.strokeText(line, W / 2, y);
            ctx.fillStyle = li === 0 ? "#ffffff" : "#fde047";
            ctx.fillText(line, W / 2, y);
          });

          // Per-slide caption (if present)
          const slideCap = photos[slideIdx].caption.trim();
          if (slideCap) {
            ctx.font = `800 ${format === "vertical" ? 30 : 32}px "Segoe UI", system-ui, sans-serif`;
            const capLines = wrapLines(ctx, slideCap, W - padX * 2 - 40, 2);
            const boxH = capLines.length * 40 + 28;
            const boxY = H - (format === "vertical" ? 295 : 225) - boxH;
            drawRoundedRect(ctx, padX, boxY, W - padX * 2, boxH, 18);
            ctx.fillStyle = "rgba(15, 10, 40, 0.78)";
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            capLines.forEach((cl, ci) => {
              ctx.fillText(cl, W / 2, boxY + 42 + ci * 40);
            });
          }

          // Price / Offer Pill
          if (priceBadge.trim()) {
            ctx.font = `900 ${format === "vertical" ? 30 : 30}px "Segoe UI", system-ui, sans-serif`;
            const pTxt = priceBadge.trim();
            const pW = Math.min(W - padX * 2, ctx.measureText(pTxt).width + 52);
            const pY = H - (format === "vertical" ? 248 : 178);
            drawRoundedRect(ctx, (W - pW) / 2, pY, pW, 60, 30);
            ctx.fillStyle = pal.badgeBg;
            ctx.fill();
            ctx.fillStyle = pal.badgeText;
            ctx.fillText(pTxt, W / 2, pY + 41, pW - 28);
          }

          // Bottom Viral CTA Bar
          const activeCta = ctaText.trim() || "👇 Comenta «PRECIO»";
          ctx.font = `900 ${format === "vertical" ? 31 : 30}px "Segoe UI", system-ui, sans-serif`;
          const ctaY = H - (format === "vertical" ? 152 : 98);
          drawRoundedRect(ctx, padX, ctaY, W - padX * 2, 74, 20);
          const ctaGrad = ctx.createLinearGradient(padX, ctaY, W - padX, ctaY);
          ctaGrad.addColorStop(0, pal.primary);
          ctaGrad.addColorStop(1, pal.accent);
          ctx.fillStyle = ctaGrad;
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.45)";
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = "#ffffff";
          ctx.fillText(activeCta, W / 2, ctaY + 48, W - padX * 2 - 28);

          // Progress Bar
          ctx.fillStyle = "rgba(255,255,255,0.22)";
          ctx.fillRect(0, H - 10, W, 10);
          ctx.fillStyle = "#fde047";
          ctx.fillRect(0, H - 10, W * ((f + 1) / totalFrames), 10);
          ctx.restore();
        }

        setRenderProgress(Math.round(((f + 1) / totalFrames) * 100));

        // Pace in real time so MediaRecorder timestamps match 30fps cleanly
        const targetElapsed = ((f + 1) / FPS) * 1000;
        const actualElapsed = performance.now() - startWall;
        const waitMs = targetElapsed - actualElapsed;
        if (waitMs > 2) {
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }

      recorder.stop();
      const blob = await stopped;
      const outUrl = URL.createObjectURL(blob);
      setVideoUrl(outUrl);
      onNotify?.(
        `🎬 ¡Video Reel generado (${totalSec.toFixed(1)} seg)! Reprodúcelo abajo y descárgalo para subirlo directo a Instagram, Facebook o Meta Ads.`
      );
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Error generando el video Reel.");
    } finally {
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
      setRendering(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-fuchsia-200 p-5 shadow-xs space-y-4 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#22115d] via-fuchsia-600 to-sky-500 text-white text-[10px] font-extrabold mb-1.5">
            <Camera className="w-3 h-3" /> NUEVO · FOTOS → VIDEO REEL
          </div>
          <h3 className="text-sm font-extrabold text-[#22115d] flex items-center gap-2">
            <Film className="w-4 h-4 text-fuchsia-600" />
            🎬 Creador de Videos / Reels desde Fotos (Modo Solo Fotos o Comercial)
          </h3>
          <p className="text-slate-500 mt-0.5 max-w-3xl">
            Sube de <strong>2 a 12 fotos</strong> de tus productos, tienda o catálogo y conviértelas al instante en un <strong>Video Reel animado descargable</strong> con movimiento suave de cámara, transiciones fluidas y música — en <strong>Modo Solo Fotos (limpio sin textos)</strong> o <strong>Modo Comercial con precio y CTA</strong>. También genera el <strong>Prompt Cinematográfico IA</strong> listo para Veo, Kling o Shorty Edit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#22115d] hover:bg-indigo-900 text-white font-bold rounded-xl"
          >
            <Upload className="w-3.5 h-3.5" /> Subir Fotos ({photos.length}/12)
          </button>
          <button
            type="button"
            disabled={loadingCatalog}
            onClick={loadFromCatalog}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl"
          >
            <Package className="w-3.5 h-3.5" />
            {loadingCatalog ? "Cargando..." : "Cargar del Catálogo"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
        </div>
      </div>

      {/* Uploaded photos strip */}
      {photos.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer p-6 rounded-2xl border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/40 hover:bg-fuchsia-50 transition text-center space-y-1.5"
        >
          <Upload className="w-6 h-6 text-fuchsia-500 mx-auto" />
          <div className="font-bold text-slate-800">
            Haz clic aquí para subir de 2 a 12 fotos de tus productos o tienda
          </div>
          <div className="text-[11px] text-slate-500">
            Funciona con fotos tomadas desde el celular (JPG, PNG, WebP) · También puedes jalar fotos de tu Catálogo
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {photos.map((ph, idx) => (
            <div
              key={ph.id}
              className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex flex-col"
            >
              <div className="relative h-24 bg-slate-200">
                <img src={ph.url} alt={ph.name} className="w-full h-full object-cover" />
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[10px] font-bold">
                  #{idx + 1}
                </span>
                <div className="absolute top-1 right-1 flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => movePhoto(idx, -1)}
                    disabled={idx === 0}
                    className="p-1 rounded bg-white/90 text-slate-700 disabled:opacity-30"
                    title="Mover antes"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePhoto(idx, 1)}
                    disabled={idx === photos.length - 1}
                    className="p-1 rounded bg-white/90 text-slate-700 disabled:opacity-30"
                    title="Mover después"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePhoto(ph.id)}
                    className="p-1 rounded bg-rose-600 text-white"
                    title="Quitar foto"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <input
                value={ph.caption}
                onChange={(e) =>
                  setPhotos((prev) =>
                    prev.map((item) => (item.id === ph.id ? { ...item, caption: e.target.value } : item))
                  )
                }
                placeholder={`Texto foto ${idx + 1} (opc.)`}
                className="w-full px-2 py-1.5 text-[11px] bg-white border-t border-slate-200 focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}

      {/* Mode Selector: Solo Fotos (Clean) vs Comercial (With Hook/Price/CTA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setOnlyPhotosMode(true)}
          className={`p-3 rounded-xl border-2 text-left transition ${
            onlyPhotosMode
              ? "border-fuchsia-600 bg-fuchsia-50/70"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="font-extrabold text-[#22115d] flex items-center gap-1.5">
            📸 Modo Solo Fotos (Cinematográfico limpio)
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5">
            Video 100% limpio sin textos ni banners encima: solo tus fotos con zoom suave, paneo y transiciones fluidas (estilo tour cinematográfico).
          </div>
        </button>
        <button
          type="button"
          onClick={() => setOnlyPhotosMode(false)}
          className={`p-3 rounded-xl border-2 text-left transition ${
            !onlyPhotosMode
              ? "border-[#22115d] bg-indigo-50/70"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="font-extrabold text-[#22115d] flex items-center gap-1.5">
            📣 Modo Comercial (con Gancho, Precio y CTA)
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5">
            Agrega tu marca, gancho arriba, etiqueta de precio/oferta y barra inferior «Comenta PRECIO» directo en el video.
          </div>
        </button>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
        <div className="md:col-span-4">
          <label className="font-semibold text-slate-700">Producto / Colección *</label>
          <input
            value={productTitle}
            onChange={(e) => setProductTitle(e.target.value)}
            placeholder="Ej. Tenis Nike y New Balance recién llegados"
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
          />
        </div>
        {!onlyPhotosMode && (
          <>
            <div className="md:col-span-4">
              <label className="font-semibold text-slate-700">Texto Gancho Arriba (Hook)</label>
              <input
                value={hookText}
                onChange={(e) => setHookText(e.target.value)}
                placeholder="Ej. LO NUEVO EN TIENDA 🔥"
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
              />
            </div>
            <div className="md:col-span-4">
              <label className="font-semibold text-slate-700">Etiqueta Precio / Beneficio</label>
              <input
                value={priceBadge}
                onChange={(e) => setPriceBadge(e.target.value)}
                placeholder="Ej. Desde ₡24.900 · Tasa Cero · Envíos CR"
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="md:col-span-4">
              <label className="font-semibold text-slate-700">Llamado a la acción (CTA Viral)</label>
              <input
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="👇 Comenta «PRECIO» y te enviamos DM"
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
              />
            </div>
          </>
        )}
        <div className="md:col-span-3">
          <label className="font-semibold text-slate-700">Formato del Video</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "vertical" | "horizontal")}
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
          >
            <option value="vertical">📱 Vertical 9:16 (Reels / TikTok)</option>
            <option value="horizontal">🖥️ Horizontal 16:9 (YouTube / Web)</option>
          </select>
        </div>
        {!onlyPhotosMode && (
          <div className="md:col-span-3">
            <label className="font-semibold text-slate-700">Estilo visual</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as VisualTheme)}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
            >
              {Object.entries(THEME_PALETTES).map(([k, val]) => (
                <option key={k} value={k}>
                  {val.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="md:col-span-2">
          <label className="font-semibold text-slate-700">Ritmo / foto</label>
          <select
            value={secPerPhoto}
            onChange={(e) => setSecPerPhoto(Number(e.target.value))}
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
          >
            <option value={1.6}>1.6s (Rápido)</option>
            <option value={2.2}>2.2s (Ideal)</option>
            <option value={3.0}>3.0s (Detalle)</option>
          </select>
        </div>
      </div>

      {/* Actions Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <label className="inline-flex items-center gap-2 text-slate-700 font-semibold cursor-pointer">
          <input
            type="checkbox"
            checked={includeMusic}
            onChange={(e) => setIncludeMusic(e.target.checked)}
            className="rounded border-slate-300"
          />
          <Music className="w-3.5 h-3.5 text-fuchsia-600" />
          Incluir música comercial rítmica (libre de derechos)
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={planning}
            onClick={generateAiPlan}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-white bg-[#22115d] hover:bg-indigo-900 disabled:opacity-50"
          >
            {planning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-sky-300" />}
            {planning ? "Creando textos y prompt IA..." : "Sugerir Textos + Prompt Cinematográfico IA"}
          </button>

          <button
            type="button"
            disabled={rendering || photos.length < 2}
            onClick={generateReelVideo}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-45 text-white font-bold rounded-xl shadow-xs"
          >
            {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
            {rendering
              ? `Renderizando video (${renderProgress}%)...`
              : onlyPhotosMode
              ? "🎬 Generar Video Solo Fotos"
              : "🎬 Generar Video Comercial"}
          </button>
        </div>
      </div>

      {/* Render Progress */}
      {rendering && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-bold text-fuchsia-800">
            <span>Armando transiciones cinematográficas, subtítulos y música en vivo...</span>
            <span>{renderProgress}%</span>
          </div>
          <div className="w-full h-2.5 bg-fuchsia-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#22115d] via-fuchsia-600 to-sky-500 transition-all"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Video Result + AI Prompt Output */}
      {(videoUrl || aiPlan) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-slate-100">
          {videoUrl && (
            <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-950 text-white space-y-3 flex flex-col items-center">
              <div className="w-full flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Video Reel listo
                </span>
                <a
                  href={videoUrl}
                  download={`Reel-${(productTitle || "Impulsa-CRM").replace(/[^a-zA-Z0-9_-]+/g, "-")}.${videoExt}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-[11px]"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar Video
                </a>
              </div>
              <video
                src={videoUrl}
                controls
                playsInline
                className={`rounded-xl border border-white/15 bg-black ${
                  format === "vertical" ? "max-h-[380px] aspect-[9/16]" : "w-full aspect-video"
                }`}
              />
            </div>
          )}

          {aiPlan && (
            <div
              className={`${
                videoUrl ? "lg:col-span-7" : "lg:col-span-12"
              } p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-extrabold text-[#22115d] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-fuchsia-600" />
                  Prompt Cinematográfico IA (para Google Veo, Kling, Runway o Shorty Edit)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(aiPlan.cinematicAiPrompt);
                    onNotify?.("📋 Prompt Cinematográfico IA copiado al portapapeles.");
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-indigo-200 text-[#22115d] rounded-lg font-bold text-[11px] hover:bg-indigo-100"
                >
                  <Copy className="w-3 h-3" /> Copiar Prompt IA
                </button>
              </div>
              <p className="p-3 rounded-xl bg-white border border-indigo-100 text-[11px] text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                {aiPlan.cinematicAiPrompt}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="font-bold text-slate-800">
                  📝 Caption viral para publicar tu Reel (Palabra clave DM:{" "}
                  <code className="px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-[#22115d]">
                    {aiPlan.ctaKeyword}
                  </code>
                  ):
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${aiPlan.socialCaption}\n\n${aiPlan.hashtags}`);
                    onNotify?.("📋 Caption viral y hashtags copiados.");
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 text-slate-800 rounded-lg font-bold text-[11px] hover:bg-slate-100"
                >
                  <Copy className="w-3 h-3" /> Copiar Caption
                </button>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 text-slate-700 whitespace-pre-wrap">
                {aiPlan.socialCaption}
                <div className="text-[#0070C0] font-semibold mt-1">{aiPlan.hashtags}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
