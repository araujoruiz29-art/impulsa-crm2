"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Flame, Send, X, RotateCcw, ArrowRight, Sparkles } from "lucide-react";

interface SuggestedRoute {
  label: string;
  href: string;
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestedRoutes?: SuggestedRoute[];
}

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  "/campanas": [
    "¿Cómo convierto fotos en un video Reel aquí?",
    "¿Cómo lanzo un anuncio en Meta Ads sin agencias?",
    "Dame un guion viral estilo «Comenta QUIERO»",
  ],
  "/bandeja": [
    "¿Cómo activo la auto-respuesta a comentarios de IG/FB?",
    "¿Cómo filtro solo clientes con Compra real?",
    "¿Cómo marco a un compañero para que el bot no le responda?",
  ],
  "/cotizaciones": [
    "¿Cómo hago una proforma PDF con IA en 3 pasos?",
    "¿Cómo cambio mi logo y cuentas bancarias del PDF?",
  ],
  "/conocimiento": [
    "¿Cómo lleno el Cuestionario Guiado IA de 7 secciones?",
    "¿Qué debo subir para que el bot no invente precios?",
  ],
  "/configuracion": [
    "¿Cómo conecto Instagram, Messenger y comentarios?",
    "¿Cómo funciona el respaldo semanal por correo?",
    "¿Cómo creo un usuario para un vendedor?",
  ],
};

const DEFAULT_SUGGESTIONS = [
  "¿Cómo creo un video Reel desde fotos y lo anuncio?",
  "¿Cómo hago una cotización PDF con IA?",
  "¿Cómo activo respuestas a comentarios en IG y FB?",
  "¿Cómo entreno mi bot en 5 minutos?",
];

function renderFormattedText(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
      <p key={i} className={line.trim() === "" ? "h-2" : "leading-relaxed"}>
        {parts.map((part, idx) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={idx} className="font-bold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("`") && part.endsWith("`")) {
            return (
              <code
                key={idx}
                className="px-1 py-0.5 rounded bg-slate-100 text-indigo-900 font-mono text-[11px]"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        })}
      </p>
    );
  });
}

export function EmberAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "¡Hola! Soy **Ember** 🔥, tu agente de ayuda dentro de **impulsa CRM**.\n\nPregúntame cómo usar cualquier botón, cómo crear Reels y anuncios en Meta Ads sin agencias, cómo entrenar tu bot o pídeme un guion viral listo para grabar.",
    },
  ]);

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, loading]);

  if (
    pathname === "/login" ||
    pathname.startsWith("/proforma/") ||
    pathname.startsWith("/tienda/") ||
    pathname.startsWith("/agendar/")
  ) {
    return null;
  }

  const quickChips =
    Object.entries(PAGE_SUGGESTIONS).find(([key]) =>
      key === "/" ? pathname === "/" : pathname.startsWith(key)
    )?.[1] || DEFAULT_SUGGESTIONS;

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || loading) return;

    const userMsg: ChatMsg = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
    };

    const nextHistory = [...messages.filter((m) => m.id !== "welcome"), userMsg];
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/ember", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          currentPath: pathname,
          history: nextHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No pude responder ahorita.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: data.reply || "Listo, aquí estoy para ayudarte.",
          suggestedRoutes: Array.isArray(data.suggestedRoutes) ? data.suggestedRoutes : [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: "assistant",
          content:
            err instanceof Error
              ? `⚠️ ${err.message}`
              : "⚠️ Hubo un problema temporal. Intenta de nuevo en unos segundos.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "¡Conversación reiniciada! Soy **Ember** 🔥. ¿En qué módulo o campaña de **impulsa CRM** te ayudo ahora?",
      },
    ]);
  };

  return (
    <>
      {/* Floating Ember Launcher Button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir Ember, agente de ayuda IA"
          className="fixed bottom-5 right-5 z-50 group flex items-center gap-2.5 pl-3.5 pr-4 py-2.5 rounded-full text-white font-bold text-xs shadow-xl hover:scale-105 active:scale-95 transition-all"
          style={{
            background: "linear-gradient(135deg, #22115d 0%, #c026d3 55%, #f97316 100%)",
            boxShadow: "0 12px 30px rgba(192, 38, 211, 0.38)",
          }}
        >
          <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white/20">
            <Flame className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#22115d]" />
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[12px] font-extrabold tracking-tight">Ember IA</span>
            <span className="text-[10px] font-medium text-white/85">¿En qué te ayudo?</span>
          </span>
        </button>
      )}

      {/* Ember Floating Drawer Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[385px] max-w-[calc(100vw-1.5rem)] h-[560px] max-h-[84vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div
            className="px-4 py-3 text-white flex items-center justify-between gap-2 shrink-0"
            style={{
              background: "linear-gradient(135deg, #1e1046 0%, #6d28d9 58%, #ea580c 100%)",
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-amber-300 fill-amber-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm">Ember</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/20 text-amber-200">
                    Agente IA
                  </span>
                </div>
                <div className="text-[11px] text-white/80 truncate">
                  Ayuda paso a paso · Manual + Anuncios
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={resetChat}
                title="Nueva conversación"
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/85 hover:text-white transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Cerrar Ember"
                className="p-1.5 rounded-lg hover:bg-white/15 text-white/85 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/70 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 shadow-2xs space-y-1 ${
                    m.role === "user"
                      ? "bg-[#22115d] text-white rounded-br-sm"
                      : "bg-white border border-slate-200/90 text-slate-700 rounded-bl-sm"
                  }`}
                >
                  {m.role === "user" ? (
                    <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    renderFormattedText(m.content)
                  )}
                </div>

                {m.suggestedRoutes && m.suggestedRoutes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5 max-w-[92%]">
                    {m.suggestedRoutes.map((r) => (
                      <button
                        key={r.href}
                        type="button"
                        onClick={() => {
                          router.push(r.href);
                          setOpen(false);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[#22115d] font-bold text-[11px] transition"
                      >
                        {r.label}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-slate-500 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-spin" />
                  <span>Ember está preparando tu respuesta...</span>
                </div>
              </div>
            )}

            {/* Quick context chips when chat is fresh */}
            {messages.length <= 2 && !loading && (
              <div className="pt-1 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  Preguntas rápidas aquí:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quickChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => sendMessage(chip)}
                      className="text-left px-2.5 py-1.5 rounded-xl bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-slate-700 hover:text-orange-950 font-medium text-[11px] transition shadow-2xs"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregúntale a Ember cómo hacer algo..."
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2 rounded-xl text-white disabled:opacity-40 transition shrink-0"
              style={{
                background: "linear-gradient(135deg, #22115d 0%, #ea580c 100%)",
              }}
              aria-label="Enviar pregunta a Ember"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
