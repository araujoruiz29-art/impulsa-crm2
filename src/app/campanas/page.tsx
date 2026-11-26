"use client";

import React, { useEffect, useState } from "react";
import {
  Megaphone,
  GitBranch,
  ShieldCheck,
  Send,
  Play,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Trash2,
  Users,
  Clock,
  Pause,
  RefreshCw,
  LayoutTemplate,
  Save,
  TrendingUp,
  Copy,
} from "lucide-react";
import { CLIENT_STAGES, formatDateCR, formatMoney } from "@/lib/format";

interface MetaAdCampaignItem {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string;
  dailyBudget: number;
  lifetimeBudget: number;
  createdTime: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  leadsOrMessages: number;
  costPerResult?: number;
}

interface VideoScriptResult {
  title: string;
  duration: string;
  keyword: string;
  hookTextOverlay: string;
  scenes: Array<{ time: string; shot: string; spoken: string; onScreenText: string }>;
  caption: string;
  hashtags: string;
  targetingTip: string;
}

interface CrmMetaAttribution {
  totalLeads: number;
  metaAdsCount: number;
  facebookCount: number;
  instagramCount: number;
  hotBuyersCount: number;
  wonCount: number;
  pipelineValue: number;
  wonValue: number;
  recentLeads: Array<{
    id: string;
    company: string;
    contactName: string;
    source: string;
    stage: string;
    estimatedValue: number;
    qualificationStatus: string;
    metaCampaign: string;
    createdAt: string;
  }>;
}

interface AdCopyVariation {
  angle: string;
  headline: string;
  primaryText: string;
  cta: string;
  targetingTip: string;
}

interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  bodyText: string;
  headerText: string;
  variableCount: number;
}

interface CampaignRecord {
  id: string;
  name: string;
  templateName: string;
  templateLanguage: string;
  targetStage: string;
  targetTag: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  skippedOptOut: number;
  createdAt: string;
}

interface AudienceInfo {
  eligibleCount: number;
  skippedOptOut: number;
  sample: Array<{ id: string; company: string; contactName: string; phone: string; stage: string }>;
}

interface SequenceStep {
  id: string;
  stepOrder: number;
  dayOffset: number;
  phase: string;
  title: string;
  messageText: string;
  templateName: string;
  templateLanguage: string;
}

interface SequenceEnrollment {
  id: string;
  clientId: string;
  status: string;
  currentStepIndex: number;
  nextRunAt: string;
  lastSentAt: string | null;
  client: { id: string; company: string; contactName: string; phone: string; stage: string } | null;
}

interface SequenceItem {
  id: string;
  name: string;
  description: string;
  active: boolean;
  steps: SequenceStep[];
  enrollments: SequenceEnrollment[];
}

interface ClientSimple {
  id: string;
  company: string;
  contactName: string;
  phone: string;
  whatsapp: string;
  stage: string;
  optOut: boolean;
}

export default function CampanasPage() {
  const [tab, setTab] = useState<"campanas" | "secuencias" | "meta_ads">("campanas");
  const [banner, setBanner] = useState("");
  const [errorBanner, setErrorBanner] = useState("");

  // Tab 3: Meta Ads (Facebook & Instagram Paid Campaigns)
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsConfigured, setAdsConfigured] = useState(false);
  const [adAccountId, setAdAccountId] = useState("");
  const [adsWarning, setAdsWarning] = useState("");
  const [adsCurrency, setAdsCurrency] = useState("CRC");
  const [adCampaigns, setAdCampaigns] = useState<MetaAdCampaignItem[]>([]);
  const [crmAttr, setCrmAttr] = useState<CrmMetaAttribution>({
    totalLeads: 0,
    metaAdsCount: 0,
    facebookCount: 0,
    instagramCount: 0,
    hotBuyersCount: 0,
    wonCount: 0,
    pipelineValue: 0,
    wonValue: 0,
    recentLeads: [],
  });
  const [togglingAdId, setTogglingAdId] = useState<string | null>(null);
  const [adCopyForm, setAdCopyForm] = useState({
    productOrPromo: "",
    objective: "Mensajes a WhatsApp / Instagram",
    audience: "Empresas y clientes en Costa Rica",
  });
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [adVariations, setAdVariations] = useState<AdCopyVariation[]>([]);

  // In-Store Reel Script Studio + Direct Meta Campaign Launcher
  const [scriptForm, setScriptForm] = useState({
    product: "",
    format: "PRESENTER",
    storeLocation: "Ciudad Quesada y La Fortuna",
    extraBenefit: "Coopelesca 10% dto · Tasa Cero · Envíos ₡3.000",
  });
  const [generatingScript, setGeneratingScript] = useState(false);
  const [videoScript, setVideoScript] = useState<VideoScriptResult | null>(null);
  const [newAdCamp, setNewAdCamp] = useState({
    name: "",
    objective: "OUTCOME_ENGAGEMENT",
    dailyBudget: 3000,
    zone: "SAN_CARLOS",
    ageMin: 18,
    ageMax: 55,
  });
  const [creatingAdCamp, setCreatingAdCamp] = useState(false);

  // Shared Meta approved templates
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [tplLoading, setTplLoading] = useState(false);

  // Tab 1: Bulk Campaigns
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [audience, setAudience] = useState<AudienceInfo>({ eligibleCount: 0, skippedOptOut: 0, sample: [] });
  const [senderInfo, setSenderInfo] = useState({ brandName: "", whatsapp: "", metaReady: false });
  const [campName, setCampName] = useState("");
  const [targetStage, setTargetStage] = useState("ALL");
  const [targetTag, setTargetTag] = useState("");
  const [selectedTpl, setSelectedTpl] = useState<MetaTemplate | null>(null);
  const [campVars, setCampVars] = useState<string[]>([]);
  const [sendingCamp, setSendingCamp] = useState(false);

  // Tab 2: 1-7-90 Sequences
  const [sequences, setSequences] = useState<SequenceItem[]>([]);
  const [clients, setClients] = useState<ClientSimple[]>([]);
  const [creatingSeq, setCreatingSeq] = useState(false);
  const [runningSeq, setRunningSeq] = useState(false);
  const [enrollClientId, setEnrollClientId] = useState("");
  const [enrollStage, setEnrollStage] = useState("COTIZADO");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepDraft, setStepDraft] = useState({ title: "", dayOffset: 1, messageText: "", templateName: "", templateLanguage: "es" });

  const loadTemplates = async () => {
    setTplLoading(true);
    try {
      const res = await fetch("/api/meta/templates");
      const data = await res.json();
      const list: MetaTemplate[] = data.templates || [];
      setTemplates(list);
      if (list.length > 0 && !selectedTpl) {
        pickCampaignTemplate(list[0]);
      }
    } catch {
      // ignore
    } finally {
      setTplLoading(false);
    }
  };

  const loadCampaigns = async (st = targetStage, tg = targetTag) => {
    const params = new URLSearchParams({ stage: st, tag: tg });
    const res = await fetch(`/api/campaigns?${params.toString()}`);
    const data = await res.json();
    setCampaigns(data.campaigns || []);
    if (data.audience) setAudience(data.audience);
    if (data.senderInfo) setSenderInfo(data.senderInfo);
  };

  const loadSequences = async () => {
    const res = await fetch("/api/sequences");
    const data = await res.json();
    setSequences(data.sequences || []);
    setClients(data.clients || []);
  };

  const loadMetaAds = async () => {
    setAdsLoading(true);
    try {
      const res = await fetch("/api/meta/ads");
      const data = await res.json();
      setAdsConfigured(Boolean(data.configured));
      setAdAccountId(String(data.adAccountId || ""));
      setAdsWarning(String(data.warning || ""));
      setAdsCurrency(String(data.currency || "CRC"));
      setAdCampaigns(Array.isArray(data.adCampaigns) ? data.adCampaigns : []);
      if (data.crmAttribution) setCrmAttr(data.crmAttribution);
    } catch {
      // ignore
    } finally {
      setAdsLoading(false);
    }
  };

  const toggleAdStatus = async (ad: MetaAdCampaignItem) => {
    const nextStatus = ad.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setTogglingAdId(ad.id);
    setBanner("");
    setErrorBanner("");
    try {
      const res = await fetch("/api/meta/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: ad.id, status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        setBanner(data.message || "Estado actualizado.");
        await loadMetaAds();
      } else {
        setErrorBanner(data.error || "No se pudo cambiar el estado.");
      }
    } finally {
      setTogglingAdId(null);
    }
  };

  const generateAdCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingCopy(true);
    setErrorBanner("");
    try {
      const res = await fetch("/api/meta/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ad_copy", ...adCopyForm }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdVariations(data.variations || []);
      } else {
        setErrorBanner(data.error || "No se pudo generar el anuncio.");
      }
    } finally {
      setGeneratingCopy(false);
    }
  };

  const generateInStoreScript = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingScript(true);
    setErrorBanner("");
    try {
      const res = await fetch("/api/meta/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "video_script", ...scriptForm }),
      });
      const data = await res.json();
      if (res.ok && data.script) {
        setVideoScript(data.script);
      } else {
        setErrorBanner(data.error || "No se pudo generar el guion.");
      }
    } finally {
      setGeneratingScript(false);
    }
  };

  const launchDirectMetaCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAdCamp(true);
    setBanner("");
    setErrorBanner("");
    try {
      const res = await fetch("/api/meta/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_campaign", ...newAdCamp }),
      });
      const data = await res.json();
      if (res.ok) {
        setBanner(data.message || "Campaña creada en Meta Ads.");
        setNewAdCamp((prev) => ({ ...prev, name: "" }));
        await loadMetaAds();
      } else {
        setErrorBanner(data.error || "No se pudo crear la campaña en Meta Ads.");
      }
    } finally {
      setCreatingAdCamp(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    loadCampaigns();
    loadSequences();
    loadMetaAds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadCampaigns(targetStage, targetTag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetStage, targetTag]);

  const pickCampaignTemplate = (t: MetaTemplate) => {
    setSelectedTpl(t);
    setCampVars(
      Array.from({ length: t.variableCount }, (_, idx) =>
        idx === 0 ? "{{contacto}}" : ""
      )
    );
  };

  const renderPreview = (t: MetaTemplate | null, vars: string[]) => {
    if (!t) return "";
    const sampleClient = audience.sample[0];
    const sampleName = sampleClient?.contactName || sampleClient?.company || "Andrea Rivera";
    const sampleCompany = sampleClient?.company || "Distribuidora Norte";
    return t.bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => {
      const raw = vars[Number(n) - 1] || `{{${n}}}`;
      return raw
        .replace(/\{\{contacto\}\}/gi, sampleName)
        .replace(/\{\{empresa\}\}/gi, sampleCompany);
    });
  };

  const launchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTpl) {
      setErrorBanner("Selecciona primero una plantilla aprobada de Meta.");
      return;
    }
    if (audience.eligibleCount === 0) {
      setErrorBanner("No hay contactos elegibles con WhatsApp para este filtro.");
      return;
    }
    if (
      !confirm(
        `¿Lanzar campaña "${campName || selectedTpl.name}" vía API Oficial de Meta a ${audience.eligibleCount} contacto(s)?\n\n(${audience.skippedOptOut} contacto(s) con opt-out serán excluidos automáticamente).`
      )
    ) {
      return;
    }
    setSendingCamp(true);
    setBanner("");
    setErrorBanner("");
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campName || `Campaña ${selectedTpl.name}`,
          templateName: selectedTpl.name,
          templateLanguage: selectedTpl.language,
          templateBodyText: selectedTpl.bodyText,
          variables: campVars,
          targetStage,
          targetTag,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || "No se pudo enviar la campaña.");
      } else {
        setBanner(`✅ ${data.message}`);
        setCampName("");
        await loadCampaigns();
      }
    } finally {
      setSendingCamp(false);
    }
  };

  const createPreset1790 = async () => {
    setCreatingSeq(true);
    setBanner("");
    setErrorBanner("");
    try {
      const res = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_1_7_90" }),
      });
      const data = await res.json();
      if (res.ok) {
        setBanner(data.message);
        await loadSequences();
      } else {
        setErrorBanner(data.error || "Error creando secuencia.");
      }
    } finally {
      setCreatingSeq(false);
    }
  };

  const enrollInSequence = async (sequenceId: string, mode: "single" | "stage") => {
    setBanner("");
    setErrorBanner("");
    const res = await fetch("/api/sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enroll",
        sequenceId,
        ...(mode === "single" ? { clientId: enrollClientId } : { stage: enrollStage }),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setBanner(data.message);
      await loadSequences();
    } else {
      setErrorBanner(data.error || "Error inscribiendo clientes.");
    }
  };

  const runDueSequences = async () => {
    setRunningSeq(true);
    setBanner("");
    setErrorBanner("");
    try {
      const res = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_due" }),
      });
      const data = await res.json();
      if (res.ok) {
        setBanner(`✅ ${data.message}`);
        await loadSequences();
      } else {
        setErrorBanner(data.error || "Error ejecutando secuencias.");
      }
    } finally {
      setRunningSeq(false);
    }
  };

  const saveStepEdit = async (stepId: string) => {
    await fetch("/api/sequences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, ...stepDraft }),
    });
    setEditingStepId(null);
    setBanner("✅ Paso de secuencia actualizado.");
    await loadSequences();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-[#0070C0]" />
            Campañas Masivas Seguras y Ciclo 1-7-90
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Envíos masivos sin riesgo de bloqueo usando la API Oficial de Meta + secuencias automáticas de seguimiento multi-día.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("campanas")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition ${
              tab === "campanas"
                ? "bg-[#22115d] text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Megaphone className="w-4 h-4" />
            1. Campañas Masivas (API Oficial)
          </button>
          <button
            type="button"
            onClick={() => setTab("secuencias")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition ${
              tab === "secuencias"
                ? "bg-[#0070C0] text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <GitBranch className="w-4 h-4" />
            2. Secuencias Ciclo 1-7-90 ({sequences.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("meta_ads");
              loadMetaAds();
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition ${
              tab === "meta_ads"
                ? "bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            3. Anuncios FB &amp; IG ({adCampaigns.length})
          </button>
        </div>
      </div>

      {banner && (
        <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900 flex items-center justify-between">
          <span>{banner}</span>
          <button onClick={() => setBanner("")} className="font-bold">✕</button>
        </div>
      )}
      {errorBanner && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-900 flex items-center justify-between">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner("")} className="font-bold">✕</button>
        </div>
      )}

      {/* ==================== TAB 1: SAFE BULK CAMPAIGNS ==================== */}
      {tab === "campanas" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Campaign Builder */}
          <form
            onSubmit={launchCampaign}
            className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Nueva Campaña WhatsApp</h2>
                <p className="text-xs text-slate-500">
                  Envía únicamente plantillas aprobadas por Meta para proteger tu número y mantener Calidad GREEN.
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  senderInfo.metaReady
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {senderInfo.metaReady ? "API Oficial Conectada" : "Meta pendiente"}
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Nombre interno de la campaña *</label>
              <input
                required
                value={campName}
                onChange={(e) => setCampName(e.target.value)}
                placeholder="Ej. Promo Uniformes y Calzado · Semana 4"
                className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl"
              />
            </div>

            {/* Audience Filters */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#0070C0]" /> Audiencia destino
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-[#0070C0] bg-sky-100 px-2.5 py-0.5 rounded-full">
                    {audience.eligibleCount} contactos elegibles
                  </span>
                  {audience.skippedOptOut > 0 && (
                    <span className="font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px]">
                      🛡️ {audience.skippedOptOut} opt-out excluidos
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Filtrar por Etapa Kanban</label>
                  <select
                    value={targetStage}
                    onChange={(e) => setTargetStage(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="ALL">Todas las etapas</option>
                    {CLIENT_STAGES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">
                    Filtrar por Etiqueta (opcional)
                  </label>
                  <input
                    value={targetTag}
                    onChange={(e) => setTargetTag(e.target.value)}
                    placeholder="Ej. Uniformes, Calzado, SICOP..."
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Meta Template Picker */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <LayoutTemplate className="w-4 h-4 text-emerald-600" />
                  Plantilla aprobada de Meta *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadTemplates}
                    className="text-[11px] font-semibold text-[#0070C0] hover:underline inline-flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${tplLoading ? "animate-spin" : ""}`} />
                    Refrescar
                  </button>
                  <a
                    href="https://business.facebook.com/wa/manage/message-templates/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                  >
                    Crear en Meta <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {templates.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
                  <div className="font-bold">Aún no tienes plantillas propias aprobadas en tu WABA</div>
                  <p>
                    Para enviar campañas masivas 100% seguras sin riesgo de bloqueo, crea al menos una plantilla en español (ej. <em>oferta_semanal</em>, <em>seguimiento_proforma</em> o <em>posventa</em>) en WhatsApp Manager y pulsa <strong>Refrescar</strong>.
                  </p>
                  <a
                    href="https://business.facebook.com/wa/manage/message-templates/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold"
                  >
                    Abrir WhatsApp Manager <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {templates.map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => pickCampaignTemplate(t)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                        selectedTpl?.id === t.id
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50"
                      }`}
                    >
                      {t.name} ({t.language})
                    </button>
                  ))}
                </div>
              )}

              {selectedTpl && selectedTpl.variableCount > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-semibold text-slate-500">
                    Variables dinámicas (usa <code>{"{{contacto}}"}</code> o <code>{"{{empresa}}"}</code> para personalizar por cliente):
                  </div>
                  {campVars.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500 w-12">{`{{${idx + 1}}}`}</span>
                      <input
                        required
                        value={v}
                        onChange={(e) => {
                          const next = [...campVars];
                          next[idx] = e.target.value;
                          setCampVars(next);
                        }}
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedTpl && (
              <div className="p-4 rounded-2xl bg-[#E7F8EE] border border-emerald-200 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Vista previa personalizada en WhatsApp ({selectedTpl.category})
                </div>
                <div className="bg-white rounded-xl p-3.5 shadow-2xs border border-emerald-100 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {selectedTpl.headerText && (
                    <div className="font-bold text-slate-900 mb-1">{selectedTpl.headerText}</div>
                  )}
                  {renderPreview(selectedTpl, campVars)}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={sendingCamp || !selectedTpl || audience.eligibleCount === 0}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {sendingCamp
                ? `Enviando campaña segura por API Oficial...`
                : `Enviar Campaña Segura a ${audience.eligibleCount} Contacto(s)`}
            </button>
          </form>

          {/* Right: Campaign History & Protection Summary */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Protección anti-bloqueo activa
              </div>
              <ul className="list-disc pl-5 space-y-1 text-emerald-900/90">
                <li>Envía únicamente mediante tu <strong>API Oficial de Meta</strong> con plantillas aprobadas.</li>
                <li>Excluye automáticamente a clientes que pidieron no recibir mensajes (<em>opt-out</em>).</li>
                <li>Registra cada envío en el historial de <strong>Conversaciones</strong> para que el equipo sepa qué recibió cada cliente.</li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Historial de Campañas ({campaigns.length})
              </h3>
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto">
                {campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">{c.name}</div>
                        <div className="text-[11px] text-slate-500">
                          Plantilla: <span className="font-mono">{c.templateName}</span> · {formatDateCR(c.createdAt)}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm("¿Eliminar registro de campaña?")) return;
                          await fetch(`/api/campaigns?id=${c.id}`, { method: "DELETE" });
                          loadCampaigns();
                        }}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                        ✅ {c.sentCount} enviados
                      </span>
                      {c.failedCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                          ❌ {c.failedCount} fallidos
                        </span>
                      )}
                      {c.skippedOptOut > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                          🛡️ {c.skippedOptOut} opt-out
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Aún no has enviado campañas masivas.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: SEQUENCES CICLO 1-7-90 ==================== */}
      {tab === "secuencias" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Secuencias Automáticas de Seguimiento («Ciclo 1-7-90»)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Para clientes que pidieron precio o proforma y dijeron <em>&ldquo;lo voy a pensar&rdquo;</em>. Se detiene automáticamente en cuanto el cliente responde, compra o pide no recibir más mensajes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={runDueSequences}
                disabled={runningSeq}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 rounded-xl"
              >
                <Play className="w-4 h-4 text-emerald-600" />
                {runningSeq ? "Ejecutando..." : "Ejecutar envíos pendientes ahora"}
              </button>
              <button
                type="button"
                onClick={createPreset1790}
                disabled={creatingSeq}
                className="btn-brand inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                {creatingSeq ? "Creando..." : "+ Crear Secuencia Ciclo 1-7-90"}
              </button>
            </div>
          </div>

          {sequences.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
              <GitBranch className="w-10 h-10 text-[#0070C0] mx-auto opacity-80" />
              <div className="text-base font-bold text-slate-900">
                Crea tu primera secuencia «Ciclo 1-7-90» en 1 clic
              </div>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                Incluye 5 seguimientos de cierre rápido (Días 1, 3, 4, 5 y 7) + rama de nutrición de 90 días (Días 15, 30, 60 y 90), todo editable y con parada automática cuando el cliente responde.
              </p>
              <button
                type="button"
                onClick={createPreset1790}
                disabled={creatingSeq}
                className="btn-brand inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl"
              >
                <Sparkles className="w-4 h-4" />
                Generar Secuencia Ciclo 1-7-90 ahora
              </button>
            </div>
          ) : (
            sequences.map((seq) => {
              const shortSteps = seq.steps.filter((s) => s.phase !== "LARGO");
              const longSteps = seq.steps.filter((s) => s.phase === "LARGO");
              const activeEnrolled = seq.enrollments.filter((e) => e.status === "ACTIVA");

              return (
                <div
                  key={seq.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                >
                  {/* Sequence Header */}
                  <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{seq.name}</h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            seq.active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {seq.active ? "Activa" : "Pausada"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{seq.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          await fetch("/api/sequences", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: seq.id, active: !seq.active }),
                          });
                          loadSequences();
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-100 inline-flex items-center gap-1"
                      >
                        {seq.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {seq.active ? "Pausar" : "Activar"}
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm("¿Eliminar esta secuencia y sus inscripciones?")) return;
                          await fetch(`/api/sequences?id=${seq.id}`, { method: "DELETE" });
                          loadSequences();
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Enroll bar */}
                  <div className="px-5 py-3.5 bg-sky-50/60 border-b border-sky-100 flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-bold text-sky-950">Inscribir contactos en este ciclo:</span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={enrollClientId}
                        onChange={(e) => setEnrollClientId(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs max-w-[200px]"
                      >
                        <option value="">-- Elegir 1 cliente --</option>
                        {clients
                          .filter((c) => !c.optOut && (c.whatsapp || c.phone))
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.company}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={!enrollClientId}
                        onClick={() => enrollInSequence(seq.id, "single")}
                        className="px-3 py-1.5 bg-[#0070C0] hover:bg-[#005a9e] disabled:opacity-40 text-white font-bold rounded-lg"
                      >
                        Inscribir cliente
                      </button>
                    </div>
                    <span className="text-slate-400">o por etapa:</span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={enrollStage}
                        onChange={(e) => setEnrollStage(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        {CLIENT_STAGES.filter((s) => !["GANADO", "PERDIDO"].includes(s.id)).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => enrollInSequence(seq.id, "stage")}
                        className="px-3 py-1.5 bg-[#22115d] hover:bg-[#2d1878] text-white font-bold rounded-lg"
                      >
                        Inscribir etapa
                      </button>
                    </div>
                  </div>

                  {/* Visual Flowchart Steps */}
                  <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 space-y-5">
                      {/* Phase 1: Days 1-7 */}
                      <div className="space-y-2.5">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-[#0070C0] flex items-center gap-1.5">
                          <Clock className="w-4 h-4" /> Fase 1 · Cierre Rápido (Días 1 al 7)
                        </div>
                        <div className="space-y-2.5 border-l-2 border-sky-200 pl-4">
                          {shortSteps.map((st) => {
                            const isEditing = editingStepId === st.id;
                            return (
                              <div
                                key={st.id}
                                className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-lg bg-[#0070C0] text-white text-[11px] font-bold">
                                      Día {st.dayOffset}
                                    </span>
                                    <span className="font-bold text-xs text-slate-900">{st.title}</span>
                                    {st.templateName && (
                                      <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                        📋 {st.templateName}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isEditing) {
                                        setEditingStepId(null);
                                      } else {
                                        setEditingStepId(st.id);
                                        setStepDraft({
                                          title: st.title,
                                          dayOffset: st.dayOffset,
                                          messageText: st.messageText,
                                          templateName: st.templateName || "",
                                          templateLanguage: st.templateLanguage || "es",
                                        });
                                      }
                                    }}
                                    className="text-[11px] font-semibold text-[#0070C0] hover:underline"
                                  >
                                    {isEditing ? "Cancelar" : "Editar / Plantilla"}
                                  </button>
                                </div>
                                {isEditing ? (
                                  <div className="space-y-2 pt-1 text-xs">
                                    <div className="grid grid-cols-3 gap-2">
                                      <input
                                        type="number"
                                        min={1}
                                        value={stepDraft.dayOffset}
                                        onChange={(e) =>
                                          setStepDraft({ ...stepDraft, dayOffset: Number(e.target.value) })
                                        }
                                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg"
                                        placeholder="Día"
                                      />
                                      <input
                                        value={stepDraft.title}
                                        onChange={(e) =>
                                          setStepDraft({ ...stepDraft, title: e.target.value })
                                        }
                                        className="col-span-2 px-2.5 py-1.5 border border-slate-200 rounded-lg"
                                        placeholder="Título del paso"
                                      />
                                    </div>
                                    <textarea
                                      rows={3}
                                      value={stepDraft.messageText}
                                      onChange={(e) =>
                                        setStepDraft({ ...stepDraft, messageText: e.target.value })
                                      }
                                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                                    />
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <select
                                        value={stepDraft.templateName}
                                        onChange={(e) => {
                                          const found = templates.find((t) => t.name === e.target.value);
                                          setStepDraft({
                                            ...stepDraft,
                                            templateName: e.target.value,
                                            templateLanguage: found?.language || "es",
                                          });
                                        }}
                                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs"
                                      >
                                        <option value="">Sin plantilla Meta (solo ventana 24h)</option>
                                        {templates.map((t) => (
                                          <option key={t.id} value={t.name}>
                                            Plantilla Meta: {t.name} ({t.language})
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => saveStepEdit(st.id)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg"
                                      >
                                        <Save className="w-3.5 h-3.5" /> Guardar paso
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-600 leading-relaxed">{st.messageText}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Phase 2: 90-day Nurturing Branch */}
                      {longSteps.length > 0 && (
                        <div className="space-y-2.5 pt-2">
                          <div className="text-xs font-extrabold uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                            <GitBranch className="w-4 h-4" /> Fase 2 · Nutrición de 90 Días (Si dijo &ldquo;ahora no&rdquo; o no ha comprado)
                          </div>
                          <div className="space-y-2.5 border-l-2 border-purple-200 pl-4">
                            {longSteps.map((st) => {
                              const isEditing = editingStepId === st.id;
                              return (
                                <div
                                  key={st.id}
                                  className="p-3.5 rounded-xl border border-purple-200/80 bg-purple-50/30 space-y-2"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 rounded-lg bg-purple-700 text-white text-[11px] font-bold">
                                        Día {st.dayOffset}
                                      </span>
                                      <span className="font-bold text-xs text-slate-900">{st.title}</span>
                                      {st.templateName && (
                                        <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                          📋 {st.templateName}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isEditing) {
                                          setEditingStepId(null);
                                        } else {
                                          setEditingStepId(st.id);
                                          setStepDraft({
                                            title: st.title,
                                            dayOffset: st.dayOffset,
                                            messageText: st.messageText,
                                            templateName: st.templateName || "",
                                            templateLanguage: st.templateLanguage || "es",
                                          });
                                        }
                                      }}
                                      className="text-[11px] font-semibold text-purple-700 hover:underline"
                                    >
                                      {isEditing ? "Cancelar" : "Editar / Plantilla"}
                                    </button>
                                  </div>
                                  {isEditing ? (
                                    <div className="space-y-2 pt-1 text-xs">
                                      <div className="grid grid-cols-3 gap-2">
                                        <input
                                          type="number"
                                          min={1}
                                          value={stepDraft.dayOffset}
                                          onChange={(e) =>
                                            setStepDraft({ ...stepDraft, dayOffset: Number(e.target.value) })
                                          }
                                          className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                                        />
                                        <input
                                          value={stepDraft.title}
                                          onChange={(e) =>
                                            setStepDraft({ ...stepDraft, title: e.target.value })
                                          }
                                          className="col-span-2 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                                        />
                                      </div>
                                      <textarea
                                        rows={3}
                                        value={stepDraft.messageText}
                                        onChange={(e) =>
                                          setStepDraft({ ...stepDraft, messageText: e.target.value })
                                        }
                                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                                      />
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <select
                                          value={stepDraft.templateName}
                                          onChange={(e) => {
                                            const found = templates.find((t) => t.name === e.target.value);
                                            setStepDraft({
                                              ...stepDraft,
                                              templateName: e.target.value,
                                              templateLanguage: found?.language || "es",
                                            });
                                          }}
                                          className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs"
                                        >
                                          <option value="">Sin plantilla Meta (solo ventana 24h)</option>
                                          {templates.map((t) => (
                                            <option key={t.id} value={t.name}>
                                              Plantilla Meta: {t.name} ({t.language})
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() => saveStepEdit(st.id)}
                                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg"
                                        >
                                          <Save className="w-3.5 h-3.5" /> Guardar paso
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-600 leading-relaxed">{st.messageText}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Enrolled clients status */}
                    <div className="lg:col-span-4 space-y-3">
                      <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span>Clientes en esta secuencia ({seq.enrollments.length})</span>
                        <span className="text-emerald-700">{activeEnrolled.length} activos</span>
                      </div>
                      <div className="space-y-2 max-h-[540px] overflow-y-auto">
                        {seq.enrollments.map((en) => {
                          const stepObj = seq.steps[en.currentStepIndex];
                          return (
                            <div
                              key={en.id}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-slate-900 truncate">
                                  {en.client?.company || "Cliente"}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                    en.status === "ACTIVA"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : en.status === "DETENIDA_RESPUESTA"
                                      ? "bg-sky-100 text-sky-800"
                                      : en.status === "COMPLETADA"
                                      ? "bg-purple-100 text-purple-800"
                                      : "bg-slate-200 text-slate-600"
                                  }`}
                                >
                                  {en.status === "DETENIDA_RESPUESTA" ? "Respondió (Parada)" : en.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {stepObj
                                  ? `Siguiente: Día ${stepObj.dayOffset} (${formatDateCR(en.nextRunAt)})`
                                  : "Secuencia finalizada"}
                              </div>
                              {en.status === "ACTIVA" && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await fetch("/api/sequences", {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ enrollmentId: en.id, status: "PAUSADA" }),
                                    });
                                    loadSequences();
                                  }}
                                  className="text-[11px] text-rose-600 font-semibold hover:underline"
                                >
                                  Pausar este cliente
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {seq.enrollments.length === 0 && (
                          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            Inscribe clientes arriba para iniciar el seguimiento automático.
                          </div>
                        )}
                      </div>

                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 space-y-1">
                        <div className="font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" />
                          Tip para días 3 al 90
                        </div>
                        <p>
                          Asigna una <strong>Plantilla Meta aprobada</strong> en cada paso (botón <em>Editar / Plantilla</em>) para que WhatsApp entregue los mensajes automáticamente incluso después de las 24 horas.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ==================== TAB 3: META ADS (FACEBOOK & INSTAGRAM) ==================== */}
      {tab === "meta_ads" && (
        <div className="space-y-6">
          {/* Top action bar + Quick links to Meta Ads Manager & Business Suite */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-pink-600" />
                Anuncios de Facebook e Instagram (Meta Ads + Resultados en CRM)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitorea el rendimiento de tus anuncios pagados, pausa o activa campañas en 1 clic, mide cuántos leads reales llegaron al CRM y crea textos de anuncios con Gemini IA.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadMetaAds}
                disabled={adsLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${adsLoading ? "animate-spin" : ""}`} />
                Actualizar
              </button>
              <a
                href={
                  adAccountId
                    ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(
                        adAccountId.replace(/^act_/, "")
                      )}`
                    : "https://adsmanager.facebook.com"
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#22115d] hover:bg-indigo-900 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                + Crear Anuncio en Meta Ads
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href="/manual#guia-anuncios"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[#22115d] text-xs font-bold rounded-xl"
              >
                📖 Guía Paso a Paso
              </a>
              <a
                href="https://business.facebook.com/latest/composer"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-800 text-xs font-bold rounded-xl"
              >
                Publicar / Historias FB &amp; IG
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* CRM Attribution KPIs from Meta Ads / Facebook / Instagram */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-[11px] font-bold uppercase text-slate-400">Prospectos FB / IG / Ads</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{crmAttr.totalLeads}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Ads: {crmAttr.metaAdsCount} · Messenger: {crmAttr.facebookCount} · IG: {crmAttr.instagramCount}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-rose-200 p-4">
              <div className="text-[11px] font-bold uppercase text-rose-600">🔥 Intención Compra Real</div>
              <div className="text-2xl font-extrabold text-rose-700 mt-1">{crmAttr.hotBuyersCount}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Clasificados por IA en bandeja</div>
            </div>
            <div className="bg-white rounded-2xl border border-emerald-200 p-4">
              <div className="text-[11px] font-bold uppercase text-emerald-700">Ventas Ganadas (Meta)</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">{crmAttr.wonCount}</div>
              <div className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                {formatMoney(crmAttr.wonValue, adsCurrency)} cerrados
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-sky-200 p-4">
              <div className="text-[11px] font-bold uppercase text-[#0070C0]">Cartera Activa Meta</div>
              <div className="text-2xl font-extrabold text-[#22115d] mt-1">
                {formatMoney(crmAttr.pipelineValue, adsCurrency)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">En negociación en Ventas Kanban</div>
            </div>
          </div>

          {/* Live Meta Ads API Campaigns Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Campañas Activas / Pausadas en Meta Ads Manager (últimos 30 días)
                </h3>
                {adAccountId && (
                  <p className="text-[11px] text-slate-500">
                    Cuenta publicitaria conectada: <code className="font-mono font-bold">{adAccountId}</code>
                  </p>
                )}
              </div>
              {!adsConfigured && (
                <a
                  href="/configuracion"
                  className="px-3 py-1.5 bg-indigo-50 text-[#22115d] text-xs font-bold rounded-xl border border-indigo-200 hover:bg-indigo-100"
                >
                  Conectar Meta Ad Account ID →
                </a>
              )}
            </div>

            {adsWarning && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950">
                <strong>Nota de conexión Meta Ads:</strong> {adsWarning}
              </div>
            )}

            {adCampaigns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-2.5 px-3">Campaña</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Presupuesto/día</th>
                      <th className="py-2.5 px-3 text-right">Gasto 30d</th>
                      <th className="py-2.5 px-3 text-right">Alcance</th>
                      <th className="py-2.5 px-3 text-right">Leads / Msgs</th>
                      <th className="py-2.5 px-3 text-right">Costo / Result.</th>
                      <th className="py-2.5 px-3 text-right">Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adCampaigns.map((ad) => {
                      const isActive = ad.status === "ACTIVE";
                      return (
                        <tr key={ad.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{ad.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {ad.objective || "META_ADS"} · ID {ad.id}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                isActive
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {isActive ? "● ACTIVA" : "⏸ PAUSADA"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-slate-700">
                            {ad.dailyBudget > 0 ? formatMoney(ad.dailyBudget, adsCurrency) : "—"}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900">
                            {formatMoney(ad.spend, adsCurrency)}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-600">
                            {ad.reach.toLocaleString("es-CR")}
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold text-[#0070C0]">
                            {ad.leadsOrMessages}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-emerald-700">
                            {ad.costPerResult && ad.costPerResult > 0
                              ? formatMoney(ad.costPerResult, adsCurrency)
                              : "—"}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              disabled={togglingAdId === ad.id}
                              onClick={() => toggleAdStatus(ad)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                isActive
                                  ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
                              }`}
                            >
                              {isActive ? (
                                <>
                                  <Pause className="w-3 h-3" /> Pausar
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3" /> Activar
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No se encontraron campañas publicitarias en esta cuenta todavía. Conecta tu <strong>Meta Ad Account ID</strong> en <em>Conexiones y empresa → Meta Cloud API</em> o crea tu primer anuncio con el botón superior.
              </div>
            )}
          </div>

          {/* In-Store Video Script Studio + Direct Meta Ads Campaign Launcher */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 1. In-Store Reel Script Studio */}
            <form
              onSubmit={generateInStoreScript}
              className="lg:col-span-7 bg-white rounded-2xl border border-indigo-200 p-5 shadow-xs space-y-4 text-xs"
            >
              <div>
                <h3 className="text-sm font-bold text-[#22115d] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#0070C0]" />
                  🎬 Estudio IA de Guiones para Grabar Reels en Tienda (sin terceros)
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Elige el formato y producto: Gemini crea el guion escena por escena (0–25 seg), qué tomas grabar con el celular, textos sin errores ortográficos, descripción local y palabra clave para tu bot.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-700">¿Qué producto o promo van a grabar en tienda? *</label>
                  <input
                    required
                    value={scriptForm.product}
                    onChange={(e) => setScriptForm({ ...scriptForm, product: e.target.value })}
                    placeholder="Ej. Relojes Garmin Forerunner 55 / 165 / 265 con 1 año de garantía"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Formato del Reel</label>
                  <select
                    value={scriptForm.format}
                    onChange={(e) => setScriptForm({ ...scriptForm, format: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="PRESENTER">Formato A · Asesor(a) en tienda + acercamientos (25 seg)</option>
                    <option value="HANDS_ONLY">Formato B · Solo manos y producto sin rostro (15 seg)</option>
                    <option value="PROMO">Formato C · Promo / Pares únicos / Temporada (20 seg)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Sucursales / Zona</label>
                  <input
                    value={scriptForm.storeLocation}
                    onChange={(e) => setScriptForm({ ...scriptForm, storeLocation: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-700">Beneficio extra a destacar</label>
                  <input
                    value={scriptForm.extraBenefit}
                    onChange={(e) => setScriptForm({ ...scriptForm, extraBenefit: e.target.value })}
                    placeholder="Ej. 10% descuento Coopelesca · Tasa Cero · Envíos ₡3.000 a todo CR"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={generatingScript}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#22115d] hover:bg-indigo-900 disabled:opacity-50 text-white font-bold rounded-xl"
              >
                <Sparkles className="w-4 h-4" />
                {generatingScript ? "Creando guion para grabar..." : "Crear Guion + Tomas + Caption con IA"}
              </button>

              {videoScript && (
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-[#22115d] text-sm">{videoScript.title}</div>
                      <div className="text-[11px] text-slate-600">
                        Duración: <strong>{videoScript.duration}</strong> · Texto gancho arriba:{" "}
                        <strong className="text-rose-700">{videoScript.hookTextOverlay}</strong> · Palabra clave DM:{" "}
                        <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-bold text-[#22115d]">
                          {videoScript.keyword}
                        </code>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(`${videoScript.caption}\n\n${videoScript.hashtags}`);
                        setBanner("📋 Descripción (Caption) y hashtags copiados para pegar en Facebook e Instagram.");
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-indigo-200 text-[#22115d] rounded-lg font-bold text-[11px] hover:bg-indigo-100"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar Caption
                    </button>
                  </div>

                  <div className="space-y-2">
                    {videoScript.scenes.map((sc, i) => (
                      <div key={i} className="p-3 rounded-xl bg-white border border-indigo-100 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-[#0070C0]">{sc.time}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                            Texto pantalla: {sc.onScreenText}
                          </span>
                        </div>
                        <div className="text-slate-600">
                          <strong>🎥 Toma celular:</strong> {sc.shot}
                        </div>
                        {sc.spoken && (
                          <div className="text-slate-900">
                            <strong>🎙️ Qué decir:</strong> &ldquo;{sc.spoken}&rdquo;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-indigo-100 space-y-1">
                    <div className="font-bold text-slate-800">📝 Descripción (Caption) lista para FB e IG:</div>
                    <p className="text-slate-700 whitespace-pre-wrap">{videoScript.caption}</p>
                    <div className="text-[#0070C0] font-semibold">{videoScript.hashtags}</div>
                  </div>
                  <div className="text-[11px] text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                    <strong>🎯 Recomendación Meta Ads:</strong> {videoScript.targetingTip}
                  </div>
                </div>
              )}
            </form>

            {/* 2. Direct Campaign + AdSet Launcher into Meta Ads */}
            <form
              onSubmit={launchDirectMetaCampaign}
              className="lg:col-span-5 bg-white rounded-2xl border border-emerald-200 p-5 shadow-xs space-y-3.5 text-xs h-fit"
            >
              <div>
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4 text-emerald-600" />
                  🚀 Crear Campaña Directo en Meta Ads (Sin Terceros)
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Crea la Campaña y el Conjunto de Anuncios segmentado directo en tu cuenta publicitaria (en estado <strong>Pausado</strong>) para que solo subas tu Reel y la enciendas aquí.
                </p>
              </div>
              <div>
                <label className="font-semibold text-slate-700">Nombre de la campaña *</label>
                <input
                  required
                  value={newAdCamp.name}
                  onChange={(e) => setNewAdCamp({ ...newAdCamp, name: e.target.value })}
                  placeholder="Ej. Garmin Mensajes San Carlos Nov"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Objetivo</label>
                <select
                  value={newAdCamp.objective}
                  onChange={(e) => setNewAdCamp({ ...newAdCamp, objective: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                >
                  <option value="OUTCOME_ENGAGEMENT">💬 Conversaciones / Mensajes (WhatsApp · IG · FB)</option>
                  <option value="OUTCOME_TRAFFIC">🌐 Tráfico a perfil / Tienda web</option>
                  <option value="OUTCOME_LEADS">📋 Formulario de Leads (Meta Lead Ads)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Presupuesto diario ({adsCurrency})</label>
                  <input
                    type="number"
                    min={500}
                    step={500}
                    value={newAdCamp.dailyBudget}
                    onChange={(e) => setNewAdCamp({ ...newAdCamp, dailyBudget: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Zona geográfica</label>
                  <select
                    value={newAdCamp.zone}
                    onChange={(e) => setNewAdCamp({ ...newAdCamp, zone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="SAN_CARLOS">Ciudad Quesada + La Fortuna</option>
                    <option value="LA_FORTUNA">Solo La Fortuna (25 km)</option>
                    <option value="GAM">GAM (San José / Alajuela / Heredia)</option>
                    <option value="COSTA_RICA">Todo Costa Rica</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Edad mínima</label>
                  <input
                    type="number"
                    min={18}
                    max={60}
                    value={newAdCamp.ageMin}
                    onChange={(e) => setNewAdCamp({ ...newAdCamp, ageMin: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Edad máxima</label>
                  <input
                    type="number"
                    min={18}
                    max={65}
                    value={newAdCamp.ageMax}
                    onChange={(e) => setNewAdCamp({ ...newAdCamp, ageMax: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creatingAdCamp}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs"
              >
                {creatingAdCamp ? "Creando en Meta Ads..." : "🚀 Crear Campaña (Pausada) en Meta Ads"}
              </button>
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-950">
                <strong>💬 Extra activado:</strong> Si suscribes los campos <code>feed</code> (Page) y <code>comments</code> (Instagram) en tu Webhook, la IA también responde automáticamente los comentarios de <em>&ldquo;Precio&rdquo;</em> y <em>&ldquo;Ubicación&rdquo;</em> enviando DM privado al instante.
              </div>
            </form>
          </div>

          {/* AI Ad Copy Generator + Recent Meta Leads */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={generateAdCopy}
              className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 text-xs"
            >
              <div>
                <h3 className="text-sm font-bold text-[#22115d] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Generador IA de Anuncios para Facebook e Instagram
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Describe lo que quieres promocionar y Gemini redacta 3 variaciones listas para copiar y pegar en Meta Ads Manager (orientadas a generar mensajes directos a tu CRM).
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-700">¿Qué producto, servicio o promoción vas a anunciar? *</label>
                  <input
                    required
                    value={adCopyForm.productOrPromo}
                    onChange={(e) => setAdCopyForm({ ...adCopyForm, productOrPromo: e.target.value })}
                    placeholder="Ej. Camisas polo corporativas con logo bordado desde 12 unidades con envío a todo el país"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700">Objetivo del anuncio</label>
                    <select
                      value={adCopyForm.objective}
                      onChange={(e) => setAdCopyForm({ ...adCopyForm, objective: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                    >
                      <option>Mensajes a WhatsApp / Instagram</option>
                      <option>Formulario de Leads (Meta Lead Ads)</option>
                      <option>Mensajes a Facebook Messenger</option>
                      <option>Tráfico a tienda web / catálogo</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700">Público objetivo</label>
                    <input
                      value={adCopyForm.audience}
                      onChange={(e) => setAdCopyForm({ ...adCopyForm, audience: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={generatingCopy}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl"
                >
                  <Sparkles className="w-4 h-4" />
                  {generatingCopy ? "Redactando anuncios con IA..." : "Generar 3 Anuncios con IA"}
                </button>
              </div>

              {adVariations.length > 0 && (
                <div className="space-y-3 pt-2">
                  {adVariations.map((v, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold text-purple-900">
                          Opción {i + 1} · {v.angle}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(
                              `${v.headline}\n\n${v.primaryText}\n\nBotón: ${v.cta}`
                            );
                            setBanner(`📋 Opción ${i + 1} copiada lista para pegar en Meta Ads Manager.`);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-purple-200 text-purple-800 rounded-lg font-bold text-[10px] hover:bg-purple-100"
                        >
                          <Copy className="w-3 h-3" /> Copiar texto
                        </button>
                      </div>
                      <div className="font-bold text-slate-900">Título: {v.headline}</div>
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{v.primaryText}</p>
                      <div className="text-[11px] text-slate-600 pt-1 border-t border-purple-100">
                        <strong>Botón CTA:</strong> {v.cta} · <strong>Tip segmentación:</strong> {v.targetingTip}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </form>

            {/* Recent Meta Leads in CRM */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Últimos clientes llegados desde FB / IG / Ads ({crmAttr.recentLeads.length})
              </h3>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {crmAttr.recentLeads.map((cl) => (
                  <div
                    key={cl.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{cl.company}</div>
                      <div className="text-[11px] text-slate-500">
                        {cl.source} · {cl.stage}
                        {cl.metaCampaign ? ` · ${cl.metaCampaign}` : ""}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                        cl.qualificationStatus === "LISTO_PARA_COMPRAR" ||
                        cl.qualificationStatus === "CALIENTE"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {cl.qualificationStatus === "LISTO_PARA_COMPRAR" ||
                      cl.qualificationStatus === "CALIENTE"
                        ? "🔥 COMPRA"
                        : "💬 CONSULTA"}
                    </span>
                  </div>
                ))}
                {crmAttr.recentLeads.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Aún no han entrado leads desde anuncios de Facebook o Instagram en esta empresa.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
