"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Search,
  X,
  ExternalLink,
  Copy,
  CheckCircle2,
  FileText,
  Send,
  Sparkles,
  Store,
} from "lucide-react";
import { formatMoney } from "@/lib/format";

interface SizeStock {
  size: string;
  attributeId: string;
  quesada: number;
  fortuna: number;
  online: number;
  totalAvailable: number;
}

interface StoreCandidate {
  idProduct: string;
  idProductAttribute: string;
  name: string;
  price: number;
  priceText: string;
  url: string;
  imageUrl: string;
}

interface VisionResult {
  vision: {
    brand: string;
    modelGuess: string;
    shoeType: string;
    colors: string[];
    searchQueries: string[];
    visualSummary: string;
    provider: string;
  };
  bestMatch: (StoreCandidate & {
    sku: string;
    brand: string;
    description: string;
    sizes: SizeStock[];
    inStockTotal: number;
  }) | null;
  matchConfidence: number;
  matchReason: string;
  candidates: StoreCandidate[];
  whatsappReply: string;
}

export function ShoeVisionModal({
  open,
  onClose,
  onUseReply,
  clientId,
}: {
  open: boolean;
  onClose: () => void;
  onUseReply?: (reply: string) => void;
  clientId?: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VisionResult | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleFileChange = (f: File | null) => {
    setFile(f);
    if (f) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl("");
    }
  };

  const runLookup = async (e?: React.FormEvent, overrideHint?: string, candidateUrl?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      if (file && !overrideHint && !candidateUrl) fd.append("file", file);
      fd.append("hint", overrideHint ?? hint);
      if (candidateUrl) fd.append("candidateUrl", candidateUrl);

      const res = await fetch("/api/ai/vision-stock", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error buscando en la tienda.");
      } else {
        setResult(data);
      }
    } catch {
      setError("No se pudo conectar con la tienda web.");
    } finally {
      setLoading(false);
    }
  };

  const copyReply = () => {
    if (!result?.whatsappReply) return;
    navigator.clipboard?.writeText(result.whatsappReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openQuoteFromShoe = () => {
    if (!result?.bestMatch) return;
    const params = new URLSearchParams({
      new: "1",
      ...(clientId ? { clientId } : {}),
      aiText: `1 ${result.bestMatch.name} (${result.bestMatch.sku}) a ${result.bestMatch.price}`,
    });
    onClose();
    router.push(`/cotizaciones?${params.toString()}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-3 md:p-6">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-[#22115d]">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Reconocimiento Visual de Calzado + Stock en Vivo
              </h2>
              <p className="text-xs text-slate-500">
                Sube solo la foto de un zapato → IA identifica el modelo y consulta tallas y precio en <strong>elcaminantecr.com/tienda</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Upload / Search Form */}
          <form onSubmit={runLookup} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-5">
              <label className="block border-2 border-dashed border-slate-300 hover:border-[#22115d] rounded-2xl p-4 text-center cursor-pointer transition bg-slate-50/70">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Foto cliente"
                    className="max-h-40 mx-auto rounded-xl object-contain"
                  />
                ) : (
                  <div className="py-5 space-y-1.5">
                    <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                    <div className="text-xs font-bold text-slate-700">
                      Subir foto enviada por el cliente
                    </div>
                    <div className="text-[11px] text-slate-400">JPG, PNG o WEBP (sin nombre)</div>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="md:col-span-7 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Pista opcional o búsqueda directa por modelo/marca (ej. Joma Top Flex, Nike, Bota)
                </label>
                <input
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="Déjalo vacío si solo tienes la foto, o escribe un modelo para probar stock en vivo..."
                  className="w-full mt-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {["Joma Top Flex", "Tenis Joma", "Zapato seguridad", "Bota PVC"].map((sample) => (
                  <button
                    type="button"
                    key={sample}
                    onClick={() => {
                      setHint(sample);
                      runLookup(undefined, sample);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 font-medium"
                  >
                    Probar: {sample}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || (!file && !hint.trim())}
                className="btn-brand w-full py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Analizando foto y consultando tallas en elcaminantecr.com/tienda/...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Identificar Modelo y Ver Tallas / Precio en Vivo
                  </>
                )}
              </button>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {error}
                </div>
              )}
            </div>
          </form>

          {/* Results */}
          {result && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              {/* Vision Analysis pill */}
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/70 text-xs text-indigo-950 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold">Análisis IA ({result.vision.provider}):</span>{" "}
                  {result.vision.visualSummary}
                  {result.vision.brand && ` · Marca: ${result.vision.brand}`}
                  {result.vision.modelGuess && ` · Modelo: ${result.vision.modelGuess}`}
                </div>
                {result.matchConfidence > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    Coincidencia {result.matchConfidence}%
                  </span>
                )}
              </div>

              {result.bestMatch ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Matched Product Card */}
                  <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    {result.bestMatch.imageUrl && (
                      <img
                        src={result.bestMatch.imageUrl}
                        alt={result.bestMatch.name}
                        className="w-full h-44 object-contain bg-white rounded-xl border border-slate-100 p-2"
                      />
                    )}
                    <div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Ref: {result.bestMatch.sku} {result.bestMatch.brand ? `· ${result.bestMatch.brand}` : ""}
                      </div>
                      <h3 className="font-bold text-base text-slate-900 mt-0.5">
                        {result.bestMatch.name}
                      </h3>
                      <div className="text-2xl font-extrabold text-[#22115d] mt-1">
                        {formatMoney(result.bestMatch.price, "CRC")}
                        <span className="text-xs font-normal text-slate-500 ml-1">IVA incl.</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={result.bestMatch.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0070C0] hover:underline"
                      >
                        Ver en elcaminantecr.com/tienda <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Live Branch Sizes Table + WhatsApp Reply */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600 flex items-center gap-1.5 mb-3">
                        <Store className="w-4 h-4 text-emerald-600" />
                        Tallas Disponibles en Vivo por Sucursal
                      </h4>
                      {result.bestMatch.sizes.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-100 text-slate-500 text-left">
                                <th className="pb-2">Talla</th>
                                <th className="pb-2 text-center">Ciudad Quesada</th>
                                <th className="pb-2 text-center">La Fortuna</th>
                                <th className="pb-2 text-center">Online</th>
                                <th className="pb-2 text-right">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {result.bestMatch.sizes.map((s) => (
                                <tr key={s.size}>
                                  <td className="py-2 font-bold text-slate-900">{s.size}</td>
                                  <td className="py-2 text-center font-semibold text-slate-700">{s.quesada}</td>
                                  <td className="py-2 text-center font-semibold text-slate-700">{s.fortuna}</td>
                                  <td className="py-2 text-center font-semibold text-slate-700">{s.online}</td>
                                  <td className="py-2 text-right">
                                    <span
                                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                        s.totalAvailable > 0
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-slate-100 text-slate-500"
                                      }`}
                                    >
                                      {s.totalAvailable > 0 ? "Disponible" : "Agotado"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Producto encontrado en tienda web (sin matriz de tallas separadas).
                        </p>
                      )}
                    </div>

                    {/* Ready WhatsApp Reply */}
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
                      <div className="text-xs font-bold text-emerald-900">
                        Respuesta lista para WhatsApp:
                      </div>
                      <pre className="text-xs text-slate-800 whitespace-pre-wrap font-sans bg-white p-3 rounded-xl border border-emerald-200/80 max-h-40 overflow-y-auto">
                        {result.whatsappReply}
                      </pre>
                      <div className="flex flex-wrap gap-2">
                        {onUseReply && (
                          <button
                            onClick={() => {
                              onUseReply(result.whatsappReply);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
                          >
                            <Send className="w-3.5 h-3.5" /> Usar en este chat
                          </button>
                        )}
                        <button
                          onClick={copyReply}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-300 text-emerald-900 text-xs font-bold rounded-xl"
                        >
                          {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied ? "¡Copiado!" : "Copiar texto"}
                        </button>
                        <button
                          onClick={openQuoteFromShoe}
                          className="btn-brand inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl"
                        >
                          <FileText className="w-3.5 h-3.5" /> Crear Proforma PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  No se encontró coincidencia automática para esa búsqueda en <code>elcaminantecr.com/tienda/</code>. Prueba agregando la marca o revisa tu API Key de Gemini en Conexiones.
                </div>
              )}

              {/* Other candidates from store */}
              {result.candidates.length > 1 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Otros modelos similares en elcaminantecr.com/tienda/
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {result.candidates.slice(1, 5).map((c) => (
                      <button
                        key={c.idProduct}
                        type="button"
                        onClick={() => runLookup(undefined, c.name, c.url)}
                        className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-[#22115d] bg-white transition space-y-1.5"
                      >
                        {c.imageUrl && (
                          <img
                            src={c.imageUrl}
                            alt={c.name}
                            className="w-full h-20 object-contain rounded-lg"
                          />
                        )}
                        <div className="text-[11px] font-bold text-slate-800 line-clamp-2">{c.name}</div>
                        <div className="text-xs font-bold text-[#22115d]">{c.priceText}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
