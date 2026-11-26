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
} from "lucide-react";
import { CLIENT_STAGES, formatDateCR } from "@/lib/format";

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
  const [tab, setTab] = useState<"campanas" | "secuencias">("campanas");
  const [banner, setBanner] = useState("");
  const [errorBanner, setErrorBanner] = useState("");

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

  useEffect(() => {
    loadTemplates();
    loadCampaigns();
    loadSequences();
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
    </div>
  );
}
