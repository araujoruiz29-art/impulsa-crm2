"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Bot,
  Sparkles,
  RefreshCw,
  FileText,
  MessageSquarePlus,
  ExternalLink,
  Mail,
  MessageCircle,
  X,
  Mic,
  Camera,
  Trash2,
} from "lucide-react";
import { formatDateCR, normalizeCRPhone } from "@/lib/format";
import { ShoeVisionModal } from "@/components/ShoeVisionModal";

interface Msg {
  id: string;
  direction: string;
  senderName: string;
  senderRole: string;
  subject: string;
  body: string;
  attachmentName: string;
  attachmentUrl: string;
  status: string;
  createdAt: string;
}

interface Conv {
  id: string;
  channel: string;
  externalId: string;
  accountEmail?: string;
  subject: string;
  status: string;
  aiEnabled: boolean;
  unreadCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  client?: {
    id: string;
    company: string;
    contactName: string;
    phone: string;
    email: string;
    assignedTo: string;
    stage: string;
    qualificationScore?: number;
    qualificationStatus?: string;
  } | null;
  messages: Msg[];
}

export default function BandejaPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [syncingEmail, setSyncingEmail] = useState(false);
  const [statusBanner, setStatusBanner] = useState("");
  const [aiGlobalPaused, setAiGlobalPaused] = useState(false);
  const [togglingGlobalAi, setTogglingGlobalAi] = useState(false);

  // Simulator modal for testing WhatsApp / Meta Lead Ads locally
  const [simOpen, setSimOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [visionOpen, setVisionOpen] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioForm, setAudioForm] = useState({
    senderName: "Esteban Vargas",
    company: "Ferretería San Carlos",
    contact: "8744-9900",
    fallbackTranscript:
      "Hola buenas, necesito urgente 20 pares de zapatos de seguridad punta composite y 40 camisas polo bordadas con nuestro logo. Si me pasan la proforma hoy mismo hacemos el adelanto por SINPE.",
  });
  const [processingAudio, setProcessingAudio] = useState(false);
  const [simForm, setSimForm] = useState({
    channel: "WHATSAPP",
    senderName: "Luis Fernándo Morales",
    company: "Constructora Norte SC",
    contact: "8845-2211",
    campaign: "Campaña Zapatos y Uniformes Meta",
    body: "Hola buenas! Vi su anuncio, ocupo cotizar 25 camisas polo bordadas con logo y 8 pares de zapatos de seguridad punta composite con IVA incluido.",
  });

  const load = async () => {
    const params = new URLSearchParams();
    if (channelFilter !== "ALL") params.set("channel", channelFilter);
    const res = await fetch(`/api/conversations?${params.toString()}`);
    const data = await res.json();
    const list: Conv[] = data.conversations || [];
    setConversations(list);
    if (!activeId && list.length > 0) setActiveId(list[0].id);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelFilter]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d?.integrations) {
          setAiGlobalPaused(Boolean(d.integrations.aiGlobalPaused));
        }
      })
      .catch(() => {});
  }, []);

  const toggleGlobalAiMode = async () => {
    setTogglingGlobalAi(true);
    const nextPaused = !aiGlobalPaused;
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrations: { aiGlobalPaused: nextPaused } }),
      });
      if (res.ok) {
        setAiGlobalPaused(nextPaused);
        setStatusBanner(
          nextPaused
            ? "✋ Modo Manual Total ACTIVADO: la IA no responderá automáticamente ningún chat nuevo hasta que la vuelvas a encender."
            : "🤖 IA Automática ACTIVADA: el Agente de IA volverá a responder mensajes, audios y fotos automáticamente."
        );
      }
    } finally {
      setTogglingGlobalAi(false);
    }
  };

  const activeConv = conversations.find((c) => c.id === activeId) || null;

  const selectConversation = async (c: Conv) => {
    setActiveId(c.id);
    if (c.unreadCount > 0) {
      await fetch(`/api/conversations/${c.id}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unreadCount: 0 }),
      });
      load();
    }
  };

  const toggleAi = async () => {
    if (!activeConv) return;
    await fetch(`/api/conversations/${activeConv.id}/messages`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiEnabled: !activeConv.aiEnabled }),
    });
    load();
  };

  const suggestAiReply = async () => {
    if (!activeConv) return;
    setAiDrafting(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", conversationId: activeConv.id }),
      });
      const data = await res.json();
      if (data.reply) setReplyText(data.reply);
    } finally {
      setAiDrafting(false);
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${activeConv.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyText }),
      });
      const data = await res.json();
      if (res.ok) {
        setReplyText("");
        if (data.deliveryInfo) setStatusBanner(data.deliveryInfo);
        load();
      }
    } finally {
      setSending(false);
    }
  };

  const syncImap = async () => {
    setSyncingEmail(true);
    setStatusBanner("");
    try {
      const res = await fetch("/api/email/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      setStatusBanner(data.message || data.error || "Sincronización finalizada.");
      load();
    } finally {
      setSyncingEmail(false);
    }
  };

  const runSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(simForm),
    });
    const data = await res.json();
    if (res.ok) {
      setSimOpen(false);
      await load();
      if (data.conversation?.id) setActiveId(data.conversation.id);
      if (data.automations?.length) {
        setStatusBanner(`Automatizaciones ejecutadas: ${data.automations.join(" | ")}`);
      }
    }
  };

  const runAudioIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingAudio(true);
    try {
      const fd = new FormData();
      if (audioFile) fd.append("file", audioFile);
      fd.append("senderName", audioForm.senderName);
      fd.append("company", audioForm.company);
      fd.append("contact", audioForm.contact);
      fd.append("fallbackTranscript", audioForm.fallbackTranscript);

      const res = await fetch("/api/ai/audio", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setAudioOpen(false);
        setAudioFile(null);
        await load();
        if (data.conversationId) setActiveId(data.conversationId);
        const alertNote = data.qualification?.alertCreated
          ? " 🔥 ¡AVISO AL VENDEDOR DISPARADO (Cliente listo para comprar, bot pausado)!"
          : "";
        setStatusBanner(`🎤 Audio procesado (${data.provider}). Calificación: ${data.qualification?.qualificationStatus} (${data.qualification?.score}/100).${alertNote}`);
      }
    } finally {
      setProcessingAudio(false);
    }
  };

  const quoteFromConversation = () => {
    if (!activeConv) return;
    const clientMessages = activeConv.messages
      .filter((m) => m.direction === "INBOUND")
      .map((m) => m.body)
      .join("\n");
    const params = new URLSearchParams({
      new: "1",
      ...(activeConv.client?.id ? { clientId: activeConv.client.id } : {}),
      aiText: clientMessages.slice(-600),
    });
    router.push(`/cotizaciones?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bandeja Omnicanal</h1>
          <p className="text-sm text-slate-500">
            WhatsApp Business (Meta Cloud API), Correo Corporativo (IMAP/SMTP), Facebook e Instagram con Agente de IA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggleGlobalAiMode}
            disabled={togglingGlobalAi}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition shadow-xs ${
              aiGlobalPaused
                ? "bg-amber-100 border-amber-300 text-amber-950 hover:bg-amber-200"
                : "bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100"
            }`}
            title="Alterna entre respuesta 100% manual en todos los chats o respuesta automática del Agente de IA"
          >
            <Bot className="w-4 h-4" />
            {aiGlobalPaused ? "Modo Manual Total (IA Apagada)" : "IA Automática: ACTIVA"}
          </button>
          <button
            onClick={syncImap}
            disabled={syncingEmail}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 text-[#0070C0] ${syncingEmail ? "animate-spin" : ""}`} />
            {syncingEmail ? "Sincronizando..." : "Sincronizar Correo IMAP"}
          </button>
          <button
            onClick={() => setVisionOpen(true)}
            className="btn-brand inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl shadow-sm"
          >
            <Camera className="w-4 h-4" />
            Foto Zapato → Stock
          </button>
          <button
            onClick={() => setAudioOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm"
          >
            <Mic className="w-4 h-4" />
            Probar Audio WhatsApp
          </button>
          <button
            onClick={() => setSimOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm"
          >
            <MessageSquarePlus className="w-4 h-4" />
            Simular WhatsApp / Lead Meta
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-center justify-between">
          <span>{statusBanner}</span>
          <button onClick={() => setStatusBanner("")} className="text-sky-700 font-bold">✕</button>
        </div>
      )}

      {/* Channel filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "ALL", label: "Todos" },
          { id: "WHATSAPP", label: "WhatsApp" },
          { id: "EMAIL", label: "Correo Corporativo" },
          { id: "FACEBOOK", label: "Messenger" },
          { id: "INSTAGRAM", label: "Instagram" },
        ].map((ch) => (
          <button
            key={ch.id}
            onClick={() => setChannelFilter(ch.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              channelFilter === ch.id
                ? "bg-[#0070C0] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {/* 2-pane Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[70vh] min-h-[520px]">
        {/* Left conversation list */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl overflow-y-auto divide-y divide-slate-100">
          {conversations.map((c) => {
            const isSelected = c.id === activeId;
            return (
              <button
                key={c.id}
                onClick={() => selectConversation(c)}
                className={`w-full text-left p-4 transition hover:bg-slate-50 ${
                  isSelected ? "bg-sky-50/70 border-l-4 border-l-[#0070C0]" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-slate-900 truncate">
                    {c.client?.company || c.subject || c.externalId}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {formatDateCR(c.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      c.channel === "WHATSAPP"
                        ? "bg-emerald-100 text-emerald-800"
                        : c.channel === "EMAIL"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {c.channel}
                  </span>
                  {c.accountEmail && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-[130px]">
                      {c.accountEmail}
                    </span>
                  )}
                  {c.client?.assignedTo && !c.accountEmail && (
                    <span className="text-[10px] text-slate-500">Resp: {c.client.assignedTo}</span>
                  )}
                  {c.unreadCount > 0 && (
                    <span className="ml-auto bg-[#0070C0] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate mt-1.5">{c.lastMessagePreview}</p>
              </button>
            );
          })}
          {conversations.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              No hay conversaciones en este canal. Usa &ldquo;Simular WhatsApp / Lead Meta&rdquo; o sincroniza tu correo IMAP.
            </div>
          )}
        </div>

        {/* Right chat pane */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden">
          {activeConv ? (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
                <div>
                  <div className="flex items-center gap-2">
                    {activeConv.channel === "EMAIL" ? (
                      <Mail className="w-4 h-4 text-[#0070C0]" />
                    ) : (
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                    )}
                    <h2 className="font-bold text-slate-900">
                      {activeConv.client?.company || activeConv.subject}
                    </h2>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>
                      {activeConv.client?.contactName ? `${activeConv.client.contactName} · ` : ""}
                      {activeConv.externalId} · Responsable: {activeConv.client?.assignedTo || "Jelsing R."}
                    </span>
                    {activeConv.client?.qualificationStatus && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          activeConv.client.qualificationStatus === "LISTO_PARA_COMPRAR"
                            ? "bg-rose-100 text-rose-800"
                            : activeConv.client.qualificationStatus === "CALIENTE"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {activeConv.client.qualificationStatus} ({activeConv.client.qualificationScore ?? 0}/100)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={toggleAi}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border ${
                      activeConv.aiEnabled
                        ? "bg-purple-50 text-purple-800 border-purple-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    IA {activeConv.aiEnabled ? "Activa" : "Pausada"}
                  </button>
                  <button
                    onClick={quoteFromConversation}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#0070C0] text-white hover:bg-[#005a9e]"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Cotizar con IA
                  </button>
                  {activeConv.channel === "WHATSAPP" && (
                    <a
                      href={`https://wa.me/${normalizeCRPhone(activeConv.externalId)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      WhatsApp <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <button
                    onClick={async () => {
                      if (!confirm("¿Eliminar esta conversación y sus mensajes?")) return;
                      await fetch("/api/cleanup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ conversationId: activeConv.id }),
                      });
                      setActiveId(null);
                      load();
                    }}
                    title="Eliminar conversación"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-rose-200 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
                {activeConv.messages.map((m) => {
                  const isOutbound = m.direction === "OUTBOUND";
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                          isOutbound
                            ? m.senderRole === "AI"
                              ? "bg-purple-600 text-white"
                              : "bg-[#0070C0] text-white"
                            : "bg-white border border-slate-200 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 text-[10px] opacity-80 mb-1">
                          <span className="font-semibold">
                            {m.senderName} {m.senderRole === "AI" ? "· Agente IA" : ""}
                          </span>
                          <span>{m.status}</span>
                        </div>
                        {m.subject && (
                          <div className="text-xs font-bold mb-1 underline">{m.subject}</div>
                        )}
                        <p className="whitespace-pre-wrap text-xs leading-relaxed">{m.body}</p>
                        {m.attachmentUrl && (
                          /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(m.attachmentUrl) ? (
                            <a
                              href={m.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block mt-2"
                            >
                              <img
                                src={m.attachmentUrl}
                                alt={m.attachmentName || "Foto producto"}
                                className="max-h-44 rounded-xl border border-white/30 bg-white object-contain"
                              />
                            </a>
                          ) : (
                            <a
                              href={m.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-xs font-semibold underline"
                            >
                              <FileText className="w-3.5 h-3.5" /> {m.attachmentName || "Ver PDF"}
                            </a>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Composer */}
              <form onSubmit={sendReply} className="p-3 border-t border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={suggestAiReply}
                    disabled={aiDrafting}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {aiDrafting ? "Redactando con catálogo..." : "Sugerir respuesta con IA"}
                  </button>
                  <span className="text-[11px] text-slate-400">
                    Canal: {activeConv.channel}
                  </span>
                </div>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Escribe tu respuesta o genera un borrador con el Agente IA..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="px-4 bg-[#0070C0] hover:bg-[#005a9e] text-white font-semibold rounded-xl flex items-center gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    Enviar
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Selecciona una conversación para responder.
            </div>
          )}
        </div>
      </div>

      {/* Simulator Modal */}
      {simOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Simulador Local de WhatsApp / Meta Lead Ads
              </h2>
              <button onClick={() => setSimOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Prueba en tu PC cómo entra un cliente nuevo, se crea en la base de datos y responde automáticamente tu Agente de IA o las reglas de Meta Ads.
            </p>
            <form onSubmit={runSimulation} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Canal</label>
                  <select
                    value={simForm.channel}
                    onChange={(e) => setSimForm({ ...simForm, channel: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="WHATSAPP">WhatsApp Entrante</option>
                    <option value="META_LEAD">Formulario Meta Lead Ads</option>
                    <option value="EMAIL">Correo Entrante</option>
                    <option value="INSTAGRAM">Instagram DM</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Teléfono / Correo</label>
                  <input
                    value={simForm.contact}
                    onChange={(e) => setSimForm({ ...simForm, contact: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Nombre contacto</label>
                  <input
                    value={simForm.senderName}
                    onChange={(e) => setSimForm({ ...simForm, senderName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Empresa</label>
                  <input
                    value={simForm.company}
                    onChange={(e) => setSimForm({ ...simForm, company: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Mensaje del cliente</label>
                <textarea
                  rows={3}
                  value={simForm.body}
                  onChange={(e) => setSimForm({ ...simForm, body: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSimOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                >
                  Simular Entrada + Disparar IA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Audio Test / Upload Modal */}
      {audioOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Mic className="w-5 h-5 text-purple-600" />
                Procesar Nota de Voz de WhatsApp
              </h2>
              <button onClick={() => setAudioOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Sube un audio real (.ogg, .mp3, .wav, .m4a) para que Gemini/Whisper lo transcriba, o usa el texto de prueba para verificar cómo califica al cliente, pausa el bot y avisa al vendedor.
            </p>
            <form onSubmit={runAudioIngest} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Contacto</label>
                  <input
                    value={audioForm.senderName}
                    onChange={(e) => setAudioForm({ ...audioForm, senderName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Empresa</label>
                  <input
                    value={audioForm.company}
                    onChange={(e) => setAudioForm({ ...audioForm, company: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Archivo de audio (opcional si usas transcripción de prueba)</label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  className="w-full mt-1 text-xs border border-slate-200 rounded-xl p-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Transcripción de respaldo / prueba</label>
                <textarea
                  rows={3}
                  value={audioForm.fallbackTranscript}
                  onChange={(e) => setAudioForm({ ...audioForm, fallbackTranscript: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAudioOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processingAudio}
                  className="px-5 py-2 text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                >
                  {processingAudio ? "Transcribiendo y calificando..." : "Procesar Audio + Calificar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ShoeVisionModal
        open={visionOpen}
        onClose={() => setVisionOpen(false)}
        clientId={activeConv?.client?.id}
        onUseReply={(txt) => setReplyText(txt)}
      />
    </div>
  );
}
