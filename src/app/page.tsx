"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  FileText,
  MessageSquare,
  TrendingUp,
  CheckCircle2,
  Circle,
  ExternalLink,
  Plus,
  Bot,
  Sparkles,
  ArrowRight,
  RefreshCw,
  BellRing,
  AlertTriangle,
} from "lucide-react";
import { CLIENT_STAGES, formatDateCR, formatMoney, QUOTE_STATUSES } from "@/lib/format";

interface DashboardData {
  kpis: {
    totalClients: number;
    openPipelineValue: number;
    quotesCount: number;
    quotesSentTotal: number;
    wonTotal: number;
    unreadMessages: number;
    pendingTasksCount: number;
    productsCount: number;
    activeRulesCount: number;
    knowledgeCount?: number;
    openAlertsCount?: number;
  };
  onboardingSteps?: Array<{ id: string; label: string; done: boolean; href: string }>;
  bottleneckStage?: { stage: string; count: number; value: number };
  sellerAlerts?: Array<{
    id: string;
    title: string;
    buyingSignals: string;
    suggestedNextStep: string;
    score: number;
    client?: { id: string; company: string } | null;
  }>;
  connections?: {
    companyName?: string;
    whatsappConnected?: boolean;
    emailConnected?: boolean;
    aiConnected?: boolean;
  };
  byStage: Record<string, { count: number; value: number }>;
  bySource: Record<string, number>;
  recentQuotes: Array<{
    id: string;
    number: number;
    clientCompany: string;
    jobTitle: string;
    total: number;
    currency: string;
    status: string;
    issueDate: string;
  }>;
  recentConversations: Array<{
    id: string;
    channel: string;
    subject: string;
    lastMessagePreview: string;
    unreadCount: number;
    client?: { company: string } | null;
  }>;
  pendingTasks: Array<{
    id: string;
    title: string;
    description: string;
    dueDate: string | null;
    completed: boolean;
    client?: { id: string; company: string } | null;
  }>;
  recentLogs: Array<{
    id: string;
    ruleName: string;
    summary: string;
    status: string;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleTask = async (id: string, completed: boolean) => {
    await fetch("/api/activities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed: !completed }),
    });
    load();
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Cargando tablero de Caminante Corporativo...
      </div>
    );
  }

  const k = data?.kpis;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Tablero Comercial · {data?.connections?.companyName || "Mi Empresa"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Resumen en tiempo real de clientes, proformas PDF, WhatsApp, correos y automatizaciones.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            Actualizar
          </button>
          <Link
            href="/bandeja"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm"
          >
            <MessageSquare className="w-4 h-4" />
            Bandeja ({k?.unreadMessages || 0})
          </Link>
          <Link
            href="/cotizaciones?new=1"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold bg-[#0070C0] hover:bg-[#005a9e] text-white rounded-xl shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nueva Proforma
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Embudo Activo
            </span>
            <div className="p-2 bg-sky-50 text-[#0070C0] rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {formatMoney(k?.openPipelineValue || 0)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {k?.totalClients || 0} clientes en base de datos
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Proformas en Seguimiento
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {formatMoney(k?.quotesSentTotal || 0)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {k?.quotesCount || 0} proformas emitidas · Ganadas: {formatMoney(k?.wonTotal || 0)}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mensajes Sin Leer
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {k?.unreadMessages || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            WhatsApp, Correo Corporativo y Meta
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Automatización e IA
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {k?.activeRulesCount || 0} reglas activas
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {k?.productsCount || 0} productos en catálogo · {k?.pendingTasksCount || 0} tareas
          </div>
        </div>
      </div>

      {/* Guided 5-Step Flow + Urgent Seller Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Seller Alerts Banner */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-rose-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-rose-800 flex items-center gap-2">
              <BellRing className="w-4 h-4 text-rose-600" />
              Avisos al Vendedor · Listos para Comprar ({data?.sellerAlerts?.length || 0})
            </h2>
            <Link href="/avisos" className="text-xs font-semibold text-rose-700 hover:underline">
              Ver todos los avisos
            </Link>
          </div>
          {(data?.sellerAlerts || []).slice(0, 2).map((al) => (
            <div
              key={al.id}
              className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="text-sm font-bold text-slate-900">{al.title}</div>
                <div className="text-xs text-slate-600 mt-0.5">{al.buyingSignals}</div>
                <div className="text-[11px] text-[#0070C0] font-semibold mt-1">{al.suggestedNextStep}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                {al.client && (
                  <Link
                    href={`/cotizaciones?new=1&clientId=${al.client.id}`}
                    className="px-3 py-1.5 text-xs font-bold bg-[#0070C0] text-white rounded-lg"
                  >
                    Proforma
                  </Link>
                )}
                <Link
                  href="/avisos"
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-rose-200 text-rose-800 rounded-lg"
                >
                  Atender
                </Link>
              </div>
            </div>
          ))}
          {(data?.sellerAlerts || []).length === 0 && (
            <div className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-xl">
              Cuando un cliente muestre señales de compra por WhatsApp, audio o correo, el bot se pausará y te avisará aquí automáticamente.
            </div>
          )}
        </div>

        {/* 5-step Guided Setup */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Puesta en marcha (5 pasos)</h2>
            <span className="text-[11px] font-bold text-[#0070C0]">
              {(data?.onboardingSteps || []).filter((s) => s.done).length}/5 listos
            </span>
          </div>
          <div className="space-y-1.5">
            {(data?.onboardingSteps || []).map((st) => (
              <Link
                key={st.id}
                href={st.href}
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 text-xs transition"
              >
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  {st.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span className={st.done ? "text-slate-600" : "text-slate-900 font-semibold"}>
                    {st.label}
                  </span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Embudo de Ventas por Etapa</h2>
            {data?.bottleneckStage && data.bottleneckStage.count > 0 && (
              <div className="inline-flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full mt-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Mayor concentración abierta en <strong>{CLIENT_STAGES.find((s) => s.id === data.bottleneckStage?.stage)?.label || data.bottleneckStage.stage}</strong> ({data.bottleneckStage.count} clientes · {formatMoney(data.bottleneckStage.value)})
              </div>
            )}
          </div>
          <Link href="/embudo" className="text-xs font-semibold text-[#0070C0] hover:underline flex items-center gap-1">
            Abrir Kanban <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {CLIENT_STAGES.map((st) => {
            const info = data?.byStage[st.id] || { count: 0, value: 0 };
            return (
              <div key={st.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                  <span className="text-xs font-semibold text-slate-700 truncate">{st.label}</span>
                </div>
                <div className="text-lg font-bold text-slate-900 mt-1">{info.count}</div>
                <div className="text-[11px] text-slate-500 truncate">{formatMoney(info.value)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2-column detail grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Proformas */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">Últimas Facturas Proforma</h2>
            <Link href="/cotizaciones" className="text-xs font-semibold text-[#0070C0] hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="pb-2.5 font-semibold">N.º</th>
                  <th className="pb-2.5 font-semibold">Cliente / Trabajo</th>
                  <th className="pb-2.5 font-semibold">Fecha</th>
                  <th className="pb-2.5 font-semibold">Estado</th>
                  <th className="pb-2.5 font-semibold text-right">Total</th>
                  <th className="pb-2.5 font-semibold text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.recentQuotes || []).map((q) => {
                  const st = QUOTE_STATUSES.find((s) => s.id === q.status);
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80">
                      <td className="py-3 font-bold text-rose-700">#{q.number}</td>
                      <td className="py-3">
                        <div className="font-semibold text-slate-900">{q.clientCompany}</div>
                        <div className="text-xs text-slate-500">{q.jobTitle || "Proforma"}</div>
                      </td>
                      <td className="py-3 text-slate-600">{formatDateCR(q.issueDate)}</td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st?.color || "bg-slate-100"}`}>
                          {st?.label || q.status}
                        </span>
                      </td>
                      <td className="py-3 text-right font-semibold text-slate-900">
                        {formatMoney(q.total, q.currency)}
                      </td>
                      <td className="py-3 text-right">
                        <a
                          href={`/api/quotes/${q.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0070C0] hover:underline"
                        >
                          PDF <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
                {(data?.recentQuotes || []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Aún no hay proformas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">Seguimientos Pendientes</h2>
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
              {data?.pendingTasks?.length || 0}
            </span>
          </div>
          <div className="space-y-2.5 flex-1">
            {(data?.pendingTasks || []).map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-100 bg-slate-50/70"
              >
                <button
                  onClick={() => toggleTask(t.id, t.completed)}
                  className="mt-0.5 text-slate-400 hover:text-emerald-600"
                  title="Marcar completada"
                >
                  {t.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800 leading-snug">{t.title}</div>
                  {t.client && (
                    <div className="text-xs text-[#0070C0] font-medium mt-0.5">{t.client.company}</div>
                  )}
                  {t.description && (
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.description}</div>
                  )}
                </div>
              </div>
            ))}
            {(data?.pendingTasks || []).length === 0 && (
              <div className="text-sm text-slate-400 text-center py-8">
                ¡Todo al día! No tienes tareas pendientes.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Inbox + Automations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900">Conversaciones Recientes</h2>
            <Link href="/bandeja" className="text-xs font-semibold text-[#0070C0] hover:underline">
              Ir a Bandeja
            </Link>
          </div>
          <div className="space-y-2">
            {(data?.recentConversations || []).map((c) => (
              <Link
                key={c.id}
                href={`/bandeja?id=${c.id}`}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
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
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {c.client?.company || c.subject}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-1">{c.lastMessagePreview}</p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="shrink-0 bg-[#0070C0] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                    {c.unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Actividad Reciente de Automatizaciones
            </h2>
            <Link href="/automatizaciones" className="text-xs font-semibold text-[#0070C0] hover:underline">
              Administrar
            </Link>
          </div>
          <div className="space-y-2">
            {(data?.recentLogs || []).map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{log.ruleName}</span>
                  <span className="text-emerald-700 font-medium">{log.status}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{log.summary}</p>
              </div>
            ))}
            {(data?.recentLogs || []).length === 0 && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-4">
                Las automatizaciones se dispararán cuando entre un mensaje de WhatsApp, un Lead de Meta Ads o envíes una Proforma. Puedes probarlo ahora desde la{" "}
                <Link href="/bandeja" className="text-[#0070C0] font-semibold underline">
                  Bandeja Omnicanal
                </Link>
                .
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick shortcut bar (only shown until WhatsApp and Corporate Email are connected) */}
      {(!data?.connections?.whatsappConnected || !data?.connections?.emailConnected) && (
        <div className="bg-gradient-to-r from-[#0070C0] to-[#005494] rounded-2xl p-5 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base">¿Listo para conectar Meta Cloud API y tu Correo Corporativo?</h3>
            <p className="text-xs text-sky-100 mt-1">
              Ingresa tus credenciales de correo corporativo (SMTP/IMAP) y tus llaves de Meta Business para atender WhatsApp, Lead Ads y enviar Proformas PDF en automático.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href="/clientes"
              className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-3.5 py-2 rounded-xl"
            >
              <Users className="w-4 h-4" />
              Base de Clientes
            </Link>
            <Link
              href="/configuracion"
              className="inline-flex items-center gap-1.5 bg-white text-[#0070C0] hover:bg-sky-50 text-xs font-bold px-3.5 py-2 rounded-xl"
            >
              Configurar Integraciones
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
