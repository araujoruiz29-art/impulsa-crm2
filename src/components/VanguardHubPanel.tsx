"use client";

import React, { useEffect, useState } from "react";
import {
  ShoppingBag,
  Calendar,
  Webhook,
  KeyRound,
  CreditCard,
  FileCheck2,
  ShieldAlert,
  BarChart3,
  Copy,
  ExternalLink,
  RefreshCw,
  Mic,
  Users,
  Send,
} from "lucide-react";

interface VanguardHubPanelProps {
  workspaceId: string;
  company: Record<string, unknown>;
  setCompany: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  integrations: Record<string, unknown>;
  setIntegrations: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  onStatus: (msg: string) => void;
}

interface AuditRow {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  summary: string;
  createdAt: string;
}

interface SlaData {
  avgFirstResponseMinutes: number | null;
  measuredConversations: number;
  byAgent: Array<{ agentName: string; conversations: number; avgMinutes: number }>;
}

interface BookingRow {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  startsAt: string;
  status: string;
}

export function VanguardHubPanel({
  workspaceId,
  company,
  setCompany,
  integrations,
  setIntegrations,
  onStatus,
}: VanguardHubPanelProps) {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [sla, setSla] = useState<SlaData | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [busyAction, setBusyAction] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "https://impulsa-crm2.vercel.app";
  const storeUrl = `${origin}/tienda/${workspaceId || "default"}`;
  const bookingUrl = `${origin}/agendar/${workspaceId || "default"}`;
  const apiUrl = `${origin}/api/v1/leads`;

  const loadAudit = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetch("/api/audit");
      const d = await res.json();
      if (res.ok) {
        setLogs(d.logs || []);
        setSla(d.sla || null);
        setBookings(d.bookings || []);
      }
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  const generateRandomApiKey = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key = "imp_live_";
    for (let i = 0; i < 32; i++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    setIntegrations((prev) => ({ ...prev, publicApiKey: key }));
    onStatus("🔑 Nueva API Key generada. Haz clic en «Guardar Configuración» abajo para activarla.");
  };

  const runAction = async (action: "weekly_report" | "test_webhook") => {
    setBusyAction(action);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          toEmail: String(integrations.weeklyReportEmail || company.email || ""),
        }),
      });
      const d = await res.json();
      onStatus(d.ok ? d.message || "✅ Acción completada." : `❌ ${d.error || "Error ejecutando acción."}`);
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="space-y-6 text-xs">
      <div>
        <h2 className="text-base font-extrabold text-[#22115d]">
          🚀 Centro de Vanguardia · Tienda Web, Agenda, Round-Robin, API/Odoo, FE CR 4.4 y Auditoría
        </h2>
        <p className="text-slate-500 mt-0.5">
          Activa tus portales públicos, reparto automático por vendedor, notas de voz IA, conectores externos (Odoo / n8n / Zapier / Shopify) y controles corporativos. Recuerda pulsar <strong>Guardar Configuración</strong> abajo al cambiar cualquier campo.
        </p>
      </div>

      {/* 1. Public Storefront (#5) + Public Booking (#8) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-[#22115d] flex items-center gap-1.5 text-sm">
              <ShoppingBag className="w-4 h-4 text-[#0070C0]" /> Mini-Catálogo Web Público
            </span>
            <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={company.publicStoreEnabled !== false}
                onChange={(e) => setCompany({ ...company, publicStoreEnabled: e.target.checked })}
              />
              Activo
            </label>
          </div>
          <p className="text-slate-600">
            Muestra tus productos con precios de mayoreo y botón «Pedir por WhatsApp / Proforma» directo a tu embudo Kanban.
          </p>
          <div className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-indigo-200">
            <code className="flex-1 truncate text-[11px] text-slate-700">{storeUrl}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(storeUrl);
                onStatus("📋 Enlace de tu Mini-Catálogo Web copiado.");
              }}
              className="px-2 py-1 rounded-lg bg-indigo-50 text-[#22115d] font-bold hover:bg-indigo-100"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <a
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1 rounded-lg bg-[#22115d] text-white font-bold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-emerald-950 flex items-center gap-1.5 text-sm">
              <Calendar className="w-4 h-4 text-emerald-600" /> Agenda Pública de Citas (estilo Calendly)
            </span>
            <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={company.publicBookingEnabled !== false}
                onChange={(e) => setCompany({ ...company, publicBookingEnabled: e.target.checked })}
              />
              Activa
            </label>
          </div>
          <p className="text-slate-600">
            Tus clientes reservan cita solos con recordatorios automáticos por WhatsApp 24h y 2h antes ({bookings.length} reservas recientes).
          </p>
          <div className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-emerald-200">
            <code className="flex-1 truncate text-[11px] text-slate-700">{bookingUrl}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(bookingUrl);
                onStatus("📋 Enlace de tu Agenda Pública de Citas copiado.");
              }}
              className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-900 font-bold hover:bg-emerald-100"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* 2. Round-Robin & SLA (#4) + Outbound AI Voice Notes (#10) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-sm">
              <Users className="w-4 h-4 text-[#0070C0]" /> Reparto Automático (Round-Robin) + SLA
            </span>
            <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(company.roundRobinEnabled)}
                onChange={(e) => setCompany({ ...company, roundRobinEnabled: e.target.checked })}
              />
              Activar turnos
            </label>
          </div>
          <p className="text-slate-600">
            Asigna automáticamente cada nuevo lead o chat entrante al siguiente vendedor activo por turno y mide el tiempo promedio de primera respuesta.
          </p>
          {sla && (
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
              <div className="font-bold text-slate-800">
                ⏱️ SLA Promedio Empresa:{" "}
                <span className="text-[#0070C0]">
                  {sla.avgFirstResponseMinutes !== null ? `${sla.avgFirstResponseMinutes} min` : "Sin medir aún"}
                </span>{" "}
                ({sla.measuredConversations} chats medidos)
              </div>
              {sla.byAgent.map((a) => (
                <div key={a.agentName} className="flex justify-between text-[11px] text-slate-600">
                  <span>{a.agentName}</span>
                  <strong>{a.avgMinutes} min ({a.conversations} chats)</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-purple-950 flex items-center gap-1.5 text-sm">
              <Mic className="w-4 h-4 text-purple-600" /> Notas de Voz IA en WhatsApp (Opcional)
            </span>
            <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(integrations.aiVoiceRepliesEnabled)}
                onChange={(e) => setIntegrations({ ...integrations, aiVoiceRepliesEnabled: e.target.checked })}
              />
              Activar audio IA
            </label>
          </div>
          <p className="text-slate-600">
            Permite enviar respuestas habladas naturales (Gemini TTS) directo como nota de voz por WhatsApp Cloud API (y también desde el botón 🎙️ en Bandeja).
          </p>
          <div>
            <label className="font-semibold text-slate-700">Voz comercial</label>
            <select
              value={String(integrations.aiVoiceName || "Aoede")}
              onChange={(e) => setIntegrations({ ...integrations, aiVoiceName: e.target.value })}
              className="w-full mt-1 px-3 py-2 bg-white border border-purple-200 rounded-xl"
            >
              <option value="Aoede">Aoede (Femenina comercial natural · Recomendada)</option>
              <option value="Kore">Kore (Femenina ejecutiva clara)</option>
              <option value="Puck">Puck (Masculina amigable)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Universal Connector: Outbound Webhooks (Odoo / n8n / Zapier / Make) + Public API (#11) */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-extrabold text-[#22115d] flex items-center gap-1.5 text-sm">
            <Webhook className="w-4 h-4 text-fuchsia-600" /> Conector Universal · Webhooks de Salida (Odoo / n8n / Zapier / Make) y API Pública
          </span>
          <button
            type="button"
            disabled={busyAction === "test_webhook"}
            onClick={() => runAction("test_webhook")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold"
          >
            <Send className="w-3.5 h-3.5" /> {busyAction === "test_webhook" ? "Probando..." : "Probar Webhook"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-700">URL Webhook de Salida (HTTPS — Odoo / n8n / Zapier / Make)</label>
            <input
              value={String(integrations.outboundWebhookUrl || "")}
              onChange={(e) => setIntegrations({ ...integrations, outboundWebhookUrl: e.target.value })}
              placeholder="https://hooks.zapier.com/... o https://tu-odoo.com/web/hook/..."
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700">Secreto de firma HMAC (X-Impulsa-Signature)</label>
            <input
              type="password"
              value={String(integrations.outboundWebhookSecret || "")}
              onChange={(e) => setIntegrations({ ...integrations, outboundWebhookSecret: e.target.value })}
              placeholder="Secreto opcional para validar firma"
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div className="md:col-span-2">
            <label className="font-semibold text-slate-700">Eventos activos (separados por coma)</label>
            <input
              value={String(
                integrations.outboundWebhookEvents ||
                  "CLIENT_CREATED,STAGE_CHANGED,QUOTE_APPROVED,PAYMENT_RECEIVED,BOOKING_CREATED,INVOICE_EMITTED"
              )}
              onChange={(e) => setIntegrations({ ...integrations, outboundWebhookEvents: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl font-mono text-[11px]"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="font-semibold text-slate-700 flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-amber-600" /> API Key Pública (para Shopify / WooCommerce / Odoo)
            </label>
            <input
              type="password"
              value={String(integrations.publicApiKey || "")}
              onChange={(e) => setIntegrations({ ...integrations, publicApiKey: e.target.value })}
              placeholder="Pulsa «Generar API Key»"
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl font-mono"
            />
          </div>
          <div className="md:col-span-3">
            <button
              type="button"
              onClick={generateRandomApiKey}
              className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 font-bold"
            >
              🔑 Generar API Key
            </button>
          </div>
          <div className="md:col-span-4">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-mono text-slate-600 truncate">
              POST {apiUrl}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Card Payment Links + CR Electronic Invoice 4.4 (#12) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-200 space-y-2.5">
          <div className="font-extrabold text-sky-950 flex items-center gap-1.5 text-sm">
            <CreditCard className="w-4 h-4 text-[#0070C0]" /> Pagos con Tarjeta (Tilopay / Onvo / Compra-Click)
          </div>
          <select
            value={String(integrations.cardPaymentProvider || "")}
            onChange={(e) => setIntegrations({ ...integrations, cardPaymentProvider: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-sky-200 rounded-xl"
          >
            <option value="">Sin pasarela configurada</option>
            <option value="TILOPAY">Tilopay (Costa Rica / LATAM)</option>
            <option value="ONVO">Onvo Pay (Costa Rica)</option>
            <option value="BAC_COMPRACLICK">BAC Compra-Click</option>
            <option value="STRIPE">Stripe</option>
            <option value="CUSTOM_LINK">Enlace personalizado</option>
          </select>
          <input
            value={String(integrations.cardPaymentLinkBase || "")}
            onChange={(e) => setIntegrations({ ...integrations, cardPaymentLinkBase: e.target.value })}
            placeholder="URL base de cobro HTTPS (ej. https://checkout.tilopay.com/...)"
            className="w-full px-3 py-2 bg-white border border-sky-200 rounded-xl"
          />
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200 space-y-2.5">
          <div className="font-extrabold text-emerald-950 flex items-center gap-1.5 text-sm">
            <FileCheck2 className="w-4 h-4 text-emerald-700" /> Facturación Electrónica CR (Hacienda 4.4)
          </div>
          <select
            value={String(integrations.feProvider || "")}
            onChange={(e) => setIntegrations({ ...integrations, feProvider: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl"
          >
            <option value="">Solo JSON borrador Hacienda 4.4</option>
            <option value="GTI">GTI Factura Electrónica</option>
            <option value="ALANUBE">Alanube API (CR 4.4)</option>
            <option value="FINANZAPRO">FinanzaPro / ERP CR</option>
            <option value="CUSTOM">API Emisor Propio / Webhook</option>
          </select>
          <input
            value={String(integrations.feApiUrl || "")}
            onChange={(e) => setIntegrations({ ...integrations, feApiUrl: e.target.value })}
            placeholder="Endpoint HTTPS del emisor FE 4.4 (opcional)"
            className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl"
          />
          <input
            type="password"
            value={String(integrations.feApiKey || "")}
            onChange={(e) => setIntegrations({ ...integrations, feApiKey: e.target.value })}
            placeholder="Token / API Key del emisor FE"
            className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl"
          />
        </div>
      </div>

      {/* 5. Weekly Executive Report + Audit Log (#13) */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-sm">
            <BarChart3 className="w-4 h-4 text-[#0070C0]" /> Reporte Ejecutivo Semanal (Lunes 7:00 a.m.) + Bitácora de Auditoría
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busyAction === "weekly_report"}
              onClick={() => runAction("weekly_report")}
              className="px-3 py-1.5 rounded-xl bg-[#22115d] hover:bg-indigo-900 text-white font-bold"
            >
              {busyAction === "weekly_report" ? "Enviando..." : "📊 Enviar Reporte Ahora"}
            </button>
            <button
              type="button"
              onClick={loadAudit}
              className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              title="Actualizar auditoría"
            >
              <RefreshCw className={`w-4 h-4 ${loadingAudit ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-700">Correo para el Reporte Ejecutivo Semanal</label>
            <input
              type="email"
              value={String(integrations.weeklyReportEmail || "")}
              onChange={(e) => setIntegrations({ ...integrations, weeklyReportEmail: e.target.value })}
              placeholder={String(company.email || "dueno@tuempresa.com")}
              className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 font-bold text-slate-700 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Últimos registros de Auditoría ({logs.length})
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
            {logs.map((l) => (
              <div key={l.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div>
                  <span className="font-extrabold text-[#22115d] mr-1.5">{l.action}</span>
                  <span className="text-slate-700">{l.summary}</span>
                </div>
                <span className="text-slate-400">
                  {l.actorEmail} · {new Date(l.createdAt).toLocaleString("es-CR")}
                </span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="p-4 text-center text-slate-400">
                Aún no hay eventos registrados en la bitácora de auditoría.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
