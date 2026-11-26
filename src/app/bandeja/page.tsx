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
  SlidersHorizontal,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  RotateCcw,
  Clock,
  UserCheck,
  LayoutTemplate,
  CheckCheck,
} from "lucide-react";
import { CLIENT_STAGES, formatDateCR, normalizeCRPhone } from "@/lib/format";
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
    contactType?: string;
    qualificationScore?: number;
    qualificationStatus?: string;
  } | null;
  messages: Msg[];
}

interface EmailAccTab {
  id: string;
  label: string;
  email: string;
  isDefault: boolean;
  active: boolean;
}

interface InboxTabDef {
  id: string;
  label: string;
  kind: "ALL" | "CHANNEL" | "EMAIL_ACCOUNT";
  channel?: string;
  accountEmail?: string;
  isDefaultEmail?: boolean;
}

interface MetaTemplateOpt {
  id: string;
  name: string;
  language: string;
  category: string;
  bodyText: string;
  headerText: string;
  variableCount: number;
}

function getWhatsAppWindowInfo(conv: Conv): {
  status: "open" | "expiring" | "closed";
  label: string;
  shortLabel: string;
} {
  const inbound = [...(conv.messages || [])]
    .reverse()
    .find((m) => m.direction === "INBOUND");
  if (!inbound) {
    return {
      status: "closed",
      label: "Sin mensaje del cliente · Usar Plantilla Meta",
      shortLabel: "24h cerrada",
    };
  }
  const elapsedMs = Date.now() - new Date(inbound.createdAt).getTime();
  const remainingMs = 24 * 60 * 60 * 1000 - elapsedMs;
  if (remainingMs <= 0) {
    return {
      status: "closed",
      label: "Ventana 24h cerrada · Usar Plantilla Meta",
      shortLabel: "24h cerrada",
    };
  }
  const hrs = Math.floor(remainingMs / (60 * 60 * 1000));
  const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hrs < 4) {
    return {
      status: "expiring",
      label: `Por vencer: quedan ${hrs}h ${mins}m`,
      shortLabel: `⚠️ ${hrs}h ${mins}m`,
    };
  }
  return {
    status: "open",
    label: `Ventana 24h: quedan ${hrs}h ${mins}m`,
    shortLabel: `${hrs}h`,
  };
}

function formatTimeCR(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

const TAB_PREFS_KEY = "impulsa_bandeja_tabs_v1";

export default function BandejaPage() {
  const router = useRouter();
  const [allConversations, setAllConversations] = useState<Conv[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccTab[]>([]);
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [intentFilter, setIntentFilter] = useState<"ALL" | "COMPRA" | "CONSULTA" | "INTERNO">("ALL");
  const [tabOrder, setTabOrder] = useState<string[]>([]);
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  const [customizingTabs, setCustomizingTabs] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [syncingEmail, setSyncingEmail] = useState(false);
  const [statusBanner, setStatusBanner] = useState("");
  const [aiGlobalPaused, setAiGlobalPaused] = useState(false);
  const [aiOnlyNewClients, setAiOnlyNewClients] = useState(false);
  const [togglingGlobalAi, setTogglingGlobalAi] = useState(false);
  const [metaLiveConnected, setMetaLiveConnected] = useState(true);
  const [isCaminanteWorkspace, setIsCaminanteWorkspace] = useState(true);
  const [syncingCrm, setSyncingCrm] = useState(false);

  // Meta approved templates modal
  const [tplOpen, setTplOpen] = useState(false);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplError, setTplError] = useState("");
  const [templates, setTemplates] = useState<MetaTemplateOpt[]>([]);
  const [selectedTpl, setSelectedTpl] = useState<MetaTemplateOpt | null>(null);
  const [tplVars, setTplVars] = useState<string[]>([]);
  const [sendingTpl, setSendingTpl] = useState(false);

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
    try {
      const res = await fetch("/api/conversations");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      const list: Conv[] = Array.isArray(data.conversations) ? data.conversations : [];
      setAllConversations(list);
    } catch {
      // ignore transient network error
    }
  };

  useEffect(() => {
    load();
    fetch("/api/email-accounts")
      .then((r) => r.json())
      .then((d) => {
        const accs: EmailAccTab[] = (d?.accounts || []).filter((a: EmailAccTab) => a.active !== false);
        setEmailAccounts(accs);
      })
      .catch(() => {});
    try {
      const raw = localStorage.getItem(TAB_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.order)) setTabOrder(parsed.order);
        if (Array.isArray(parsed.hidden)) setHiddenTabs(parsed.hidden);
      }
    } catch {
      // ignore storage errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveTabPrefs = (nextOrder: string[], nextHidden: string[]) => {
    setTabOrder(nextOrder);
    setHiddenTabs(nextHidden);
    try {
      localStorage.setItem(TAB_PREFS_KEY, JSON.stringify({ order: nextOrder, hidden: nextHidden }));
    } catch {
      // ignore storage errors
    }
  };

  // Build dynamic tabs: each configured email account gets its own separated inbox tab!
  const defaultTabs: InboxTabDef[] = [
    { id: "ALL", label: "Todos", kind: "ALL" },
    { id: "WHATSAPP", label: "WhatsApp", kind: "CHANNEL", channel: "WHATSAPP" },
    ...(emailAccounts.length > 0
      ? emailAccounts
          .filter((acc) => Boolean(acc?.email))
          .map((acc) => {
            const cleanEmail = String(acc.email || "").trim().toLowerCase();
            return {
              id: `EMAIL::${cleanEmail}`,
              label: acc.label ? `${acc.label} (${cleanEmail})` : cleanEmail,
              kind: "EMAIL_ACCOUNT" as const,
              channel: "EMAIL",
              accountEmail: cleanEmail,
              isDefaultEmail: acc.isDefault,
            };
          })
      : [{ id: "EMAIL", label: "Correo Corporativo", kind: "CHANNEL" as const, channel: "EMAIL" }]),
    ...(emailAccounts.length > 1
      ? [{ id: "EMAIL", label: "Todos los Correos", kind: "CHANNEL" as const, channel: "EMAIL" }]
      : []),
    { id: "FACEBOOK", label: "Messenger", kind: "CHANNEL", channel: "FACEBOOK" },
    { id: "INSTAGRAM", label: "Instagram", kind: "CHANNEL", channel: "INSTAGRAM" },
  ];

  const orderedTabs: InboxTabDef[] = (() => {
    const byId = new Map(defaultTabs.map((t) => [t.id, t]));
    const result: InboxTabDef[] = [];
    for (const id of tabOrder) {
      const found = byId.get(id);
      if (found) {
        result.push(found);
        byId.delete(id);
      }
    }
    for (const remaining of byId.values()) {
      result.push(remaining);
    }
    return result;
  })();

  const visibleTabs = orderedTabs.filter((t) => !hiddenTabs.includes(t.id));

  const matchesTab = (c: Conv, tabId: string): boolean => {
    if (tabId === "ALL") return true;
    if (tabId.startsWith("EMAIL::")) {
      const targetEmail = tabId.replace("EMAIL::", "").toLowerCase();
      if (c.channel !== "EMAIL") return false;
      const convEmail = (c.accountEmail || "").trim().toLowerCase();
      if (convEmail) return convEmail === targetEmail;
      // Legacy email threads without accountEmail belong to the default email account
      const defAcc = emailAccounts.find((a) => a.isDefault) || emailAccounts[0];
      return defAcc ? defAcc.email.toLowerCase() === targetEmail : false;
    }
    return c.channel === tabId;
  };

  const getIntentCategory = (c: Conv): "COMPRA" | "CONSULTA" | "INTERNO" => {
    if (c.client?.contactType && c.client.contactType !== "CLIENTE") return "INTERNO";
    const qs = c.client?.qualificationStatus || "";
    const score = c.client?.qualificationScore || 0;
    if (
      qs === "LISTO_PARA_COMPRAR" ||
      qs === "CALIENTE" ||
      score >= 50 ||
      c.client?.stage === "NEGOCIACION" ||
      c.client?.stage === "COTIZADO"
    ) {
      return "COMPRA";
    }
    return "CONSULTA";
  };

  const tabFilteredConversations = allConversations.filter((c) => matchesTab(c, channelFilter));
  const intentCounts = {
    ALL: tabFilteredConversations.length,
    COMPRA: tabFilteredConversations.filter((c) => getIntentCategory(c) === "COMPRA").length,
    CONSULTA: tabFilteredConversations.filter((c) => getIntentCategory(c) === "CONSULTA").length,
    INTERNO: tabFilteredConversations.filter((c) => getIntentCategory(c) === "INTERNO").length,
  };
  const conversations =
    intentFilter === "ALL"
      ? tabFilteredConversations
      : tabFilteredConversations.filter((c) => getIntentCategory(c) === intentFilter);

  useEffect(() => {
    if (conversations.length > 0 && !conversations.some((c) => c.id === activeId)) {
      setActiveId(conversations[0].id);
    } else if (conversations.length === 0) {
      setActiveId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelFilter, intentFilter, allConversations]);

  const moveTab = (tabId: string, dir: -1 | 1) => {
    const ids = orderedTabs.map((t) => t.id);
    const idx = ids.indexOf(tabId);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= ids.length) return;
    const copy = [...ids];
    [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
    saveTabPrefs(copy, hiddenTabs);
  };

  const toggleTabHidden = (tabId: string) => {
    const isHidden = hiddenTabs.includes(tabId);
    const nextHidden = isHidden
      ? hiddenTabs.filter((id) => id !== tabId)
      : [...hiddenTabs, tabId];
    // Prevent hiding every single tab
    if (orderedTabs.every((t) => nextHidden.includes(t.id))) return;
    saveTabPrefs(orderedTabs.map((t) => t.id), nextHidden);
    if (!isHidden && channelFilter === tabId) {
      const firstVisible = orderedTabs.find((t) => !nextHidden.includes(t.id));
      if (firstVisible) setChannelFilter(firstVisible.id);
    }
  };

  const resetTabPrefs = () => {
    saveTabPrefs([], []);
    setChannelFilter("ALL");
  };

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d?.integrations) {
          setAiGlobalPaused(Boolean(d.integrations.aiGlobalPaused));
          setAiOnlyNewClients(Boolean(d.integrations.aiOnlyNewClients));
          setMetaLiveConnected(
            Boolean(
              (d.integrations.metaAccessToken && d.integrations.metaPhoneNumberId) ||
                ((d.integrations.metaPageAccessToken || d.integrations.metaAccessToken) &&
                  (d.integrations.metaPageId || d.integrations.metaIgAccountId))
            )
          );
        } else {
          setMetaLiveConnected(false);
        }
        if (d?.company) {
          setIsCaminanteWorkspace(d.company.id === "default");
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

  const toggleOnlyNewClients = async () => {
    setTogglingGlobalAi(true);
    const nextOnlyNew = !aiOnlyNewClients;
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrations: { aiOnlyNewClients: nextOnlyNew } }),
      });
      if (res.ok) {
        setAiOnlyNewClients(nextOnlyNew);
        setStatusBanner(
          nextOnlyNew
            ? "🆕 IA Solo Clientes Nuevos ACTIVADO: la IA solo responderá a prospectos nuevos (etapa Nuevo Lead) y NO contestará a clientes existentes ni a compañeros."
            : "🌐 IA configurada para atender a todos los clientes comerciales (siempre excluye compañeros/proveedores)."
        );
      }
    } finally {
      setTogglingGlobalAi(false);
    }
  };

  const toggleInternalContact = async () => {
    if (!activeConv?.client?.id) return;
    const isCurrentlyInternal =
      activeConv.client.contactType && activeConv.client.contactType !== "CLIENTE";
    const nextType = isCurrentlyInternal ? "CLIENTE" : "INTERNO";
    const res = await fetch(`/api/clients/${activeConv.client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactType: nextType }),
    });
    if (res.ok) {
      setStatusBanner(
        nextType === "INTERNO"
          ? `👥 "${activeConv.client.company}" marcado como Compañero / Sin IA: la IA nunca le contestará, no generará avisos ni saldrá en Ventas Kanban.`
          : `✅ "${activeConv.client.company}" volvió a ser Cliente comercial normal.`
      );
      await load();
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

  const syncCrmNow = async () => {
    if (!activeConv) return;
    setSyncingCrm(true);
    setStatusBanner("");
    try {
      const res = await fetch(`/api/conversations/${activeConv.id}/sync-crm`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.result?.updated) {
        const r = data.result;
        const stageLabel = CLIENT_STAGES.find((s) => s.id === r.stage)?.label || r.stage;
        const parts = [`Etapa Kanban → ${stageLabel}`];
        if (r.tags) parts.push(`Etiquetas: ${r.tags}`);
        if (r.taskCreated) parts.push(`📅 Agendado: ${r.taskCreated}`);
        if (r.summary) parts.push(`Resumen: ${r.summary}`);
        setStatusBanner(`✨ CRM actualizado automáticamente: ${parts.join(" · ")}`);
        await load();
      } else {
        setStatusBanner(data.error || data.result?.reason || "No hubo cambios nuevos para actualizar.");
      }
    } finally {
      setSyncingCrm(false);
    }
  };

  const openTemplatesModal = async () => {
    setTplOpen(true);
    setTplLoading(true);
    setTplError("");
    try {
      const res = await fetch("/api/meta/templates");
      const data = await res.json();
      if (data.error) {
        setTplError(data.error);
        setTemplates([]);
      } else {
        const list: MetaTemplateOpt[] = data.templates || [];
        setTemplates(list);
        if (list.length > 0) {
          selectTemplateItem(list[0]);
        } else if (data.warning) {
          setTplError(data.warning);
        }
      }
    } catch {
      setTplError("No se pudieron cargar las plantillas de Meta.");
    } finally {
      setTplLoading(false);
    }
  };

  const selectTemplateItem = (t: MetaTemplateOpt) => {
    setSelectedTpl(t);
    const defaultName =
      activeConv?.client?.contactName ||
      activeConv?.client?.company ||
      activeConv?.subject ||
      "Cliente";
    const initialVars = Array.from({ length: t.variableCount }, (_, idx) =>
      idx === 0 ? defaultName : ""
    );
    setTplVars(initialVars);
  };

  const renderTemplatePreview = (t: MetaTemplateOpt | null, vars: string[]) => {
    if (!t) return "";
    return t.bodyText.replace(/\{\{(\d+)\}\}/g, (_, numStr) => {
      const idx = Number(numStr) - 1;
      return vars[idx]?.trim() || `{{${numStr}}}`;
    });
  };

  const sendMetaTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !selectedTpl) return;
    setSendingTpl(true);
    setTplError("");
    try {
      const preview = renderTemplatePreview(selectedTpl, tplVars);
      const res = await fetch("/api/meta/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConv.id,
          to: activeConv.externalId,
          templateName: selectedTpl.name,
          language: selectedTpl.language,
          variables: tplVars,
          renderedPreview: preview,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTplError(data.error || "No se pudo enviar la plantilla.");
      } else {
        setTplOpen(false);
        setStatusBanner(`✅ ${data.message}`);
        await load();
      }
    } finally {
      setSendingTpl(false);
    }
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
          {!aiGlobalPaused && (
            <button
              onClick={toggleOnlyNewClients}
              disabled={togglingGlobalAi}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition shadow-xs ${
                aiOnlyNewClients
                  ? "bg-sky-100 border-sky-300 text-sky-950 hover:bg-sky-200"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
              title="Si está activo, la IA solo responde a clientes nuevos y no interviene en clientes ya existentes"
            >
              {aiOnlyNewClients ? "🆕 IA: Solo Clientes Nuevos" : "IA: Todos los Clientes"}
            </button>
          )}
          <button
            onClick={syncImap}
            disabled={syncingEmail}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 text-[#0070C0] ${syncingEmail ? "animate-spin" : ""}`} />
            {syncingEmail ? "Sincronizando..." : "Sincronizar Correo IMAP"}
          </button>
          {isCaminanteWorkspace && (
            <button
              onClick={() => setVisionOpen(true)}
              className="btn-brand inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl shadow-sm"
            >
              <Camera className="w-4 h-4" />
              Buscar por Foto · Stock
            </button>
          )}
          {!metaLiveConnected && (
            <>
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
            </>
          )}
        </div>
      </div>

      {statusBanner && (
        <div className="px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-center justify-between">
          <span>{statusBanner}</span>
          <button onClick={() => setStatusBanner("")} className="text-sky-700 font-bold">✕</button>
        </div>
      )}

      {/* Channel & Separated Email Inbox filters + Custom Order */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {visibleTabs.map((ch) => {
            const tabConvs = allConversations.filter((c) => matchesTab(c, ch.id));
            const unreadInTab = tabConvs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
            const isActive = channelFilter === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setChannelFilter(ch.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? "bg-[#0070C0] text-white shadow-xs"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {ch.kind === "EMAIL_ACCOUNT" && (
                  <Mail className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-[#0070C0]"}`} />
                )}
                <span>{ch.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : unreadInTab > 0
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tabConvs.length}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setCustomizingTabs(!customizingTabs)}
            className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              customizingTabs
                ? "bg-indigo-50 border-indigo-300 text-[#22115d]"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            title="Reordenar u ocultar pestañas de conexiones y bandejas de correo"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Acomodar conexiones
          </button>
        </div>

        {customizingTabs && (
          <div className="bg-white border border-indigo-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Acomodar orden y visibilidad de conexiones y bandejas de correo
                </div>
                <p className="text-[11px] text-slate-500">
                  Usa las flechas para acomodarlas a tu gusto u oculta canales que aún no uses. Tus correos corporativos aparecen separados por cuenta.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetTabPrefs}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  <RotateCcw className="w-3 h-3" /> Restablecer
                </button>
                <button
                  type="button"
                  onClick={() => setCustomizingTabs(false)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#22115d] text-white"
                >
                  Listo
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {orderedTabs.map((t, idx) => {
                const isHidden = hiddenTabs.includes(t.id);
                return (
                  <div
                    key={t.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs ${
                      isHidden
                        ? "bg-slate-50 border-slate-200 text-slate-400 opacity-75"
                        : "bg-indigo-50/50 border-indigo-200 text-slate-800"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => moveTab(t.id, -1)}
                      disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-white disabled:opacity-30"
                      title="Mover a la izquierda"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-semibold max-w-[200px] truncate">{t.label}</span>
                    <button
                      type="button"
                      onClick={() => moveTab(t.id, 1)}
                      disabled={idx === orderedTabs.length - 1}
                      className="p-0.5 rounded hover:bg-white disabled:opacity-30"
                      title="Mover a la derecha"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleTabHidden(t.id)}
                      className={`p-1 rounded ml-0.5 ${
                        isHidden
                          ? "text-slate-400 hover:text-emerald-700 hover:bg-white"
                          : "text-indigo-700 hover:text-rose-600 hover:bg-white"
                      }`}
                      title={isHidden ? "Mostrar pestaña" : "Ocultar pestaña"}
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* AI Purchase Intent vs General Inquiry quick filter bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3.5 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
          Clasificación IA:
        </span>
        {(
          [
            { id: "ALL", label: "Todos", activeCls: "bg-slate-900 text-white", idleCls: "bg-slate-100 text-slate-700 hover:bg-slate-200" },
            { id: "COMPRA", label: "🔥 Compra real", activeCls: "bg-rose-600 text-white", idleCls: "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100" },
            { id: "CONSULTA", label: "💬 Solo consultas", activeCls: "bg-sky-600 text-white", idleCls: "bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100" },
            { id: "INTERNO", label: "👥 Compañeros · Sin IA", activeCls: "bg-slate-700 text-white", idleCls: "bg-slate-100 text-slate-600 hover:bg-slate-200" },
          ] as const
        ).map((item) => {
          const active = intentFilter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setIntentFilter(item.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition ${
                active ? item.activeCls : item.idleCls
              }`}
            >
              <span>{item.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                  active ? "bg-white/25 text-white" : "bg-white/80 text-slate-700"
                }`}
              >
                {intentCounts[item.id]}
              </span>
            </button>
          );
        })}
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
                  {c.channel === "WHATSAPP" && (() => {
                    const win = getWhatsAppWindowInfo(c);
                    return (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          win.status === "expiring"
                            ? "bg-amber-100 text-amber-900"
                            : win.status === "closed"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                        title={win.label}
                      >
                        {win.shortLabel}
                      </span>
                    );
                  })()}
                  {c.client?.contactType && c.client.contactType !== "CLIENTE" ? (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                      {c.client.contactType === "PROVEEDOR" ? "PROVEEDOR · SIN IA" : "COMPAÑERO · SIN IA"}
                    </span>
                  ) : (
                    <>
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                          getIntentCategory(c) === "COMPRA"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-sky-100 text-sky-800"
                        }`}
                        title={`Puntaje IA: ${c.client?.qualificationScore || 0}/100 (${c.client?.qualificationStatus || "CONSULTA"})`}
                      >
                        {getIntentCategory(c) === "COMPRA" ? "🔥 COMPRA" : "💬 CONSULTA"}
                      </span>
                      {(c.channel === "WHATSAPP" || c.channel === "FACEBOOK" || c.channel === "INSTAGRAM") && (
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                            c.aiEnabled ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {c.aiEnabled ? "BOT" : "AGENTE"}
                        </span>
                      )}
                    </>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    {activeConv.channel === "EMAIL" ? (
                      <Mail className="w-4 h-4 text-[#0070C0]" />
                    ) : (
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                    )}
                    <h2 className="font-bold text-slate-900">
                      {activeConv.client?.company || activeConv.subject}
                    </h2>
                    {activeConv.client?.contactType && activeConv.client.contactType !== "CLIENTE" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        👥 {activeConv.client.contactType === "PROVEEDOR" ? "PROVEEDOR · SIN IA" : "COMPAÑERO / AGENTE · SIN IA"}
                      </span>
                    ) : (
                      <>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            getIntentCategory(activeConv) === "COMPRA"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-sky-100 text-sky-800"
                          }`}
                          title={`Puntaje IA: ${activeConv.client?.qualificationScore || 0}/100`}
                        >
                          {getIntentCategory(activeConv) === "COMPRA"
                            ? `🔥 COMPRA REAL (${activeConv.client?.qualificationScore || 0}%)`
                            : "💬 CONSULTA"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            activeConv.aiEnabled
                              ? "bg-purple-100 text-purple-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {activeConv.aiEnabled ? (
                            <>
                              <Bot className="w-3 h-3" /> BOT ACTIVO
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3" /> AGENTE
                            </>
                          )}
                        </span>
                      </>
                    )}
                    {activeConv.client?.stage && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-[#0070C0]">
                        {CLIENT_STAGES.find((s) => s.id === activeConv.client?.stage)?.label ||
                          activeConv.client.stage}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                    <span>
                      {activeConv.client?.contactName ? `${activeConv.client.contactName} · ` : ""}
                      {activeConv.externalId}
                    </span>
                    {activeConv.channel === "WHATSAPP" && (() => {
                      const win = getWhatsAppWindowInfo(activeConv);
                      return (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            win.status === "open"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : win.status === "expiring"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : "bg-rose-100 text-rose-800 border border-rose-200"
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {win.label}
                        </span>
                      );
                    })()}
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
                  {activeConv.client?.id && (
                    <button
                      onClick={toggleInternalContact}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                        activeConv.client.contactType && activeConv.client.contactType !== "CLIENTE"
                          ? "bg-slate-800 text-white border-slate-800 hover:bg-slate-700"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                      title="Marca este contacto como Compañero/Agente para que la IA nunca le conteste ni salga en Ventas Kanban"
                    >
                      {activeConv.client.contactType && activeConv.client.contactType !== "CLIENTE"
                        ? "👥 Interno (Quitar)"
                        : "👥 Compañero · Sin IA"}
                    </button>
                  )}
                  <button
                    onClick={toggleAi}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                      activeConv.aiEnabled
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                        : "bg-purple-600 text-white border-purple-600 hover:bg-purple-700"
                    }`}
                    title={
                      activeConv.aiEnabled
                        ? "Pausa el bot para responder tú personalmente"
                        : "Devuelve el control automático de este chat al Agente de IA"
                    }
                  >
                    {activeConv.aiEnabled ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" /> Tomar control
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5" /> Devolver al bot
                      </>
                    )}
                  </button>
                  <button
                    onClick={syncCrmNow}
                    disabled={syncingCrm}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-[#22115d] border border-indigo-200 hover:bg-indigo-100"
                    title="La IA lee el chat y actualiza automáticamente etapa Kanban, etiquetas, resumen y citas en Agenda"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${syncingCrm ? "animate-spin" : ""}`} />
                    {syncingCrm ? "Actualizando..." : "Actualizar CRM"}
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
                        <div className="flex items-center justify-between gap-4 text-[10px] opacity-90 mb-1">
                          <span className="font-bold inline-flex items-center gap-1">
                            {isOutbound ? (
                              <span className="px-1.5 py-0.2 rounded bg-white/20 text-[9px] uppercase">
                                {m.senderRole === "AI" ? "BOT" : "AGENTE"}
                              </span>
                            ) : null}
                            {m.senderName}
                          </span>
                          <span className="inline-flex items-center gap-1 opacity-80">
                            {formatTimeCR(m.createdAt)}
                            {isOutbound && <CheckCheck className="w-3 h-3" />}
                          </span>
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
                {activeConv.channel === "WHATSAPP" && getWhatsAppWindowInfo(activeConv).status === "closed" && (
                  <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong>Ventana de 24h cerrada:</strong> WhatsApp requiere usar una <strong>Plantilla Oficial de Meta</strong> para reabrir la conversación.
                    </span>
                    <button
                      type="button"
                      onClick={openTemplatesModal}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold"
                    >
                      Abrir Plantillas Meta
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={suggestAiReply}
                      disabled={aiDrafting}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {aiDrafting ? "Redactando con catálogo..." : "Sugerir respuesta con IA"}
                    </button>
                    {activeConv.channel === "WHATSAPP" && (
                      <button
                        type="button"
                        onClick={openTemplatesModal}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl"
                      >
                        <LayoutTemplate className="w-3.5 h-3.5" />
                        Plantillas Meta
                      </button>
                    )}
                  </div>
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

      {/* Modal: Send Approved Meta WhatsApp Template (outside 24h window) */}
      {tplOpen && activeConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <LayoutTemplate className="w-5 h-5 text-emerald-600" />
                Plantillas Oficiales de Meta · {activeConv.client?.company || activeConv.subject}
              </h2>
              <button onClick={() => setTplOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Envía plantillas aprobadas directamente desde tu cuenta WhatsApp Business (WABA) para contactar clientes incluso cuando ya cerró la ventana de 24 horas.
            </p>

            {tplError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {tplError}
              </div>
            )}

            {tplLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Consultando plantillas aprobadas en tu cuenta Meta Business...
              </div>
            ) : templates.length === 0 ? (
              <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2.5">
                <div className="font-bold">Aún no tienes plantillas propias aprobadas en Meta</div>
                <p>
                  Crea tus plantillas en español (ej. <em>seguimiento_proforma</em>, <em>oferta_semanal</em>, <em>posventa</em>) en WhatsApp Manager — Meta suele aprobarlas en 1–2 minutos y aparecerán aquí automáticamente.
                </p>
                <a
                  href="https://business.facebook.com/wa/manage/message-templates/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                >
                  Crear Plantilla en WhatsApp Manager <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <form onSubmit={sendMetaTemplate} className="space-y-4 text-sm">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                    Selecciona una plantilla aprobada ({templates.length})
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {templates.map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => selectTemplateItem(t)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                          selectedTpl?.id === t.id
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50"
                        }`}
                      >
                        {t.name} ({t.language})
                      </button>
                    ))}
                  </div>
                </div>

                {selectedTpl && (
                  <>
                    {selectedTpl.variableCount > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-600">
                          Variables del mensaje ({selectedTpl.variableCount})
                        </div>
                        {tplVars.map((val, idx) => (
                          <div key={idx}>
                            <label className="text-[11px] text-slate-500">
                              Variable {`{{${idx + 1}}}`}
                            </label>
                            <input
                              required
                              value={val}
                              onChange={(e) => {
                                const next = [...tplVars];
                                next[idx] = e.target.value;
                                setTplVars(next);
                              }}
                              placeholder={`Valor para {{${idx + 1}}}`}
                              className="w-full mt-0.5 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                        Vista previa personalizada ({selectedTpl.category})
                      </div>
                      {selectedTpl.headerText && (
                        <div className="text-xs font-bold text-slate-900">{selectedTpl.headerText}</div>
                      )}
                      <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {renderTemplatePreview(selectedTpl, tplVars)}
                      </p>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTplOpen(false)}
                    className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={sendingTpl || !selectedTpl}
                    className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sendingTpl ? "Enviando..." : "Enviar Plantilla Oficial"}
                  </button>
                </div>
              </form>
            )}
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
