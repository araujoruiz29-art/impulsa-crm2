"use client";

import React, { useEffect, useState } from "react";
import {
  Bot,
  Sparkles,
  Play,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  Send,
  RefreshCw,
} from "lucide-react";
import { formatDateCR } from "@/lib/format";

interface Rule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  channel: string;
  delayHours: number;
  actionType: string;
  templateText: string;
  targetStage: string;
  active: boolean;
  runCount: number;
  lastRunAt: string | null;
}

interface LogItem {
  id: string;
  ruleName: string;
  trigger: string;
  status: string;
  summary: string;
  createdAt: string;
}

const TRIGGERS = [
  { id: "NEW_WHATSAPP_MESSAGE", label: "Nuevo mensaje de WhatsApp" },
  { id: "NEW_META_LEAD", label: "Nuevo Lead de Meta Ads (FB/IG)" },
  { id: "NEW_EMAIL", label: "Nuevo correo corporativo entrante" },
  { id: "QUOTE_SENT", label: "Al enviar una Factura Proforma" },
  { id: "QUOTE_NO_RESPONSE", label: "Proforma sin respuesta (con espera)" },
  { id: "STAGE_CHANGED", label: "Cambio de etapa en el Embudo" },
];

const ACTIONS = [
  { id: "AI_REPLY", label: "Responder con Agente de IA" },
  { id: "SEND_TEMPLATE", label: "Enviar mensaje de plantilla" },
  { id: "SEND_FOLLOWUP", label: "Enviar seguimiento automático" },
  { id: "CREATE_TASK", label: "Crear tarea / cita en Agenda" },
  { id: "MOVE_STAGE", label: "Mover etapa del cliente" },
];

export default function AutomatizacionesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [runningFollowups, setRunningFollowups] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Internal AI CRM Assistant chat
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantMode, setAssistantMode] = useState<"assistant_chat" | "reply">("assistant_chat");
  const [assistantChat, setAssistantChat] = useState<{ role: string; text: string }[]>([
    {
      role: "ai",
      text: "Hola Jelsing 👋 Soy tu Agente IA de Caminante Corporativo.\n• En modo **Asistente CRM** puedo consultar proformas pendientes, revisar clientes o crear tareas/citas en tu Agenda (ej: *\"Agenda llamada con Tico Frut mañana\"*).\n• En modo **Simular Cliente** puedes probar cómo respondo a tus clientes en WhatsApp usando tu catálogo en colones con IVA 13% incluido.",
    },
  ]);
  const [thinking, setThinking] = useState(false);

  // New rule form
  const [showNew, setShowNew] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    trigger: "QUOTE_NO_RESPONSE",
    channel: "WHATSAPP",
    delayHours: 48,
    actionType: "SEND_FOLLOWUP",
    templateText:
      "Hola {{contacto}}, le saludamos de Caminante Corporativo. ¿Pudo revisar la proforma #{{numero}} por {{total}}? Quedamos atentos.",
    targetStage: "SEGUIMIENTO",
  });

  const load = async () => {
    const res = await fetch("/api/automations");
    const data = await res.json();
    setRules(data.rules || []);
    setLogs(data.logs || []);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleRule = async (r: Rule) => {
    await fetch(`/api/automations/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !r.active }),
    });
    load();
  };

  const deleteRule = async (id: string) => {
    if (!confirm("¿Eliminar esta regla de automatización?")) return;
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
    load();
  };

  const createRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.name.trim()) return;
    await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRule),
    });
    setShowNew(false);
    setNewRule({ ...newRule, name: "", description: "" });
    load();
  };

  const createReactivationRule = async () => {
    await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Reactivación de clientes anteriores (30 días)",
        description:
          "Contacta automáticamente a clientes que ya compraron para ofrecer reposición de uniformes, bordados o zapatos de seguridad.",
        trigger: "STAGE_CHANGED",
        channel: "WHATSAPP",
        delayHours: 720,
        actionType: "SEND_TEMPLATE",
        templateText:
          "Hola {{contacto}} de {{empresa}}, ¡esperamos que estén muy bien! En Caminante Corporativo tenemos disponibilidad inmediata en uniformes, bordados y calzado de seguridad. ¿Necesitan reponer inventario este mes?",
        targetStage: "",
        active: true,
      }),
    });
    setFeedback("Regla de reactivación de clientes creada y activada.");
    load();
  };

  const runFollowupsNow = async () => {
    setRunningFollowups(true);
    setFeedback("");
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_followups" }),
      });
      const data = await res.json();
      setFeedback(
        data.count > 0
          ? `Se enviaron ${data.count} seguimiento(s) automático(s).`
          : "Revisión completa: ninguna proforma ha superado aún su tiempo de espera configurado."
      );
      load();
    } finally {
      setRunningFollowups(false);
    }
  };

  const sendAssistantMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assistantInput.trim()) return;
    const msg = assistantInput.trim();
    setAssistantInput("");
    setAssistantChat((prev) => [...prev, { role: "user", text: msg }]);
    setThinking(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: assistantMode, message: msg }),
      });
      const data = await res.json();
      setAssistantChat((prev) => [
        ...prev,
        { role: "ai", text: data.reply || data.error || "Sin respuesta." },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agente IA y Automatizaciones</h1>
          <p className="text-sm text-slate-500">
            Atención automática en WhatsApp y Meta Ads, seguimientos con esperas, reactivación de clientes y asistente que crea tareas y citas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runFollowupsNow}
            disabled={runningFollowups}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            <Play className="w-4 h-4 text-emerald-600" />
            {runningFollowups ? "Ejecutando..." : "Ejecutar seguimientos ahora"}
          </button>
          <button
            onClick={createReactivationRule}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200 rounded-xl hover:bg-purple-100"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            + Regla Reactivación
          </button>
          <button
            onClick={() => setShowNew(!showNew)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#0070C0] hover:bg-[#005a9e] text-white rounded-xl shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nueva Regla
          </button>
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {feedback}
          </span>
          <button onClick={() => setFeedback("")}>✕</button>
        </div>
      )}

      {/* Main 2-column: AI Assistant Playground + Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* AI Assistant */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 flex flex-col h-[540px] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-sky-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-600" />
                <h2 className="font-bold text-slate-900 text-sm">Agente IA Caminante</h2>
              </div>
              <div className="flex rounded-lg bg-white border border-slate-200 p-0.5 text-[11px] font-semibold">
                <button
                  onClick={() => setAssistantMode("assistant_chat")}
                  className={`px-2 py-1 rounded-md ${
                    assistantMode === "assistant_chat" ? "bg-purple-600 text-white" : "text-slate-600"
                  }`}
                >
                  Asistente CRM
                </button>
                <button
                  onClick={() => setAssistantMode("reply")}
                  className={`px-2 py-1 rounded-md ${
                    assistantMode === "reply" ? "bg-emerald-600 text-white" : "text-slate-600"
                  }`}
                >
                  Simular Cliente
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {assistantChat.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#0070C0] text-white"
                      : "bg-white border border-slate-200 text-slate-800"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="text-xs text-purple-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Consultando CRM y catálogo...
              </div>
            )}
          </div>

          <div className="p-2.5 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-1.5">
            {[
              "¿Qué proformas tenemos pendientes?",
              "Agenda llamada con Tico Frut mañana",
              "¿Cuánto valen 20 polos bordadas?",
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => setAssistantInput(chip)}
                className="text-[10px] px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-sky-50"
              >
                {chip}
              </button>
            ))}
          </div>

          <form onSubmit={sendAssistantMessage} className="p-3 border-t border-slate-200 flex gap-2 bg-white">
            <input
              value={assistantInput}
              onChange={(e) => setAssistantInput(e.target.value)}
              placeholder={
                assistantMode === "assistant_chat"
                  ? "Pregunta al CRM o pide agendar una cita/tarea..."
                  : "Escribe como cliente de WhatsApp para probar al agente..."
              }
              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
            />
            <button
              type="submit"
              disabled={thinking}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Automation Rules */}
        <div className="lg:col-span-7 space-y-4">
          {showNew && (
            <form
              onSubmit={createRule}
              className="bg-white rounded-2xl border-2 border-[#0070C0]/30 p-5 shadow-xs space-y-3 text-sm"
            >
              <h3 className="font-bold text-slate-900">Crear Nueva Regla de Automatización</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Nombre de la regla *</label>
                  <input
                    required
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="Ej. Recordatorio de proforma a los 3 días"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Cuando ocurra (Disparador)</label>
                  <select
                    value={newRule.trigger}
                    onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    {TRIGGERS.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Acción automática</label>
                  <select
                    value={newRule.actionType}
                    onChange={(e) => setNewRule({ ...newRule, actionType: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    {ACTIONS.map((a) => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Canal</label>
                  <select
                    value={newRule.channel}
                    onChange={(e) => setNewRule({ ...newRule, channel: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Correo Corporativo</option>
                    <option value="ALL">Todos los canales</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Espera (en horas)</label>
                  <input
                    type="number"
                    min={0}
                    value={newRule.delayHours}
                    onChange={(e) => setNewRule({ ...newRule, delayHours: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Plantilla de mensaje (variables: {"{{contacto}}"}, {"{{empresa}}"}, {"{{numero}}"}, {"{{total}}"})
                  </label>
                  <textarea
                    rows={2}
                    value={newRule.templateText}
                    onChange={(e) => setNewRule({ ...newRule, templateText: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 text-xs border rounded-xl">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-bold bg-[#0070C0] text-white rounded-xl">
                  Guardar Regla
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {rules.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">{r.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-[#0070C0]">
                      {r.trigger}
                    </span>
                    {r.delayHours > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
                        <Clock className="w-3 h-3" /> Espera: {r.delayHours}h
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{r.description || r.templateText}</p>
                  <div className="text-[11px] text-slate-400">
                    Canal: {r.channel} · Acción: {r.actionType} · Ejecuciones: {r.runCount}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleRule(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      r.active
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {r.active ? "Activa" : "Pausada"}
                  </button>
                  <button
                    onClick={() => deleteRule(r.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Execution Logs */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Bitácora de Ejecuciones</h3>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {logs.map((l) => (
                <div key={l.id} className="text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-800">{l.ruleName}</span>
                    <div className="text-slate-500">{l.summary}</div>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{formatDateCR(l.createdAt)}</span>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-xs text-slate-400">Aún no hay ejecuciones registradas.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
