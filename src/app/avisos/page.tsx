"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  CheckCircle2,
  FileText,
  MessageSquare,
  Flame,
  RefreshCw,
  Bot,
  Trash2,
} from "lucide-react";
import { formatDateCR, formatMoney } from "@/lib/format";

interface AlertItem {
  id: string;
  conversationId: string;
  priority: string;
  title: string;
  buyingSignals: string;
  suggestedNextStep: string;
  score: number;
  resolved: boolean;
  createdAt: string;
  client?: {
    id: string;
    company: string;
    contactName: string;
    phone: string;
    email: string;
    estimatedValue: number;
    stage: string;
  } | null;
}

export default function AvisosPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/alerts");
    const data = await res.json();
    setAlerts(data.alerts || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resolveAlert = async (a: AlertItem, reactivateAi: boolean) => {
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: a.id,
        resolved: !a.resolved,
        read: true,
        reactivateAi,
      }),
    });
    if (!a.resolved) {
      setFeedback(
        reactivateAi
          ? "✅ Aviso marcado como atendido y Bot de IA reactivado para esa conversación."
          : "✅ Aviso marcado como atendido (el bot sigue pausado en ese chat para que tú sigas respondiendo)."
      );
    }
    load();
  };

  const deleteAlert = async (id: string) => {
    if (!confirm("¿Eliminar este aviso del historial?")) return;
    await fetch(`/api/alerts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  };

  const clearResolved = async () => {
    if (!confirm("¿Limpiar todo el historial de avisos ya atendidos?")) return;
    await fetch("/api/alerts?resolved=1", { method: "DELETE" });
    setFeedback("✅ Historial de avisos atendidos limpiado.");
    load();
  };

  const pending = alerts.filter((a) => !a.resolved);
  const resolved = alerts.filter((a) => a.resolved);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BellRing className="w-6 h-6 text-rose-600" />
            Avisos al Vendedor · Clientes Listos para Comprar
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cuando el Agente IA detecta intención de compra (cantidades, pedido, SINPE o solicitud de proforma), pausa el bot y te avisa aquí con un resumen para cerrar la venta.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" /> Actualizar
        </button>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback("")} className="font-bold">✕</button>
        </div>
      )}

      {/* Pending High-Intent Alerts */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-rose-700">
          Pendientes de atención ({pending.length})
        </h2>
        {pending.map((a) => (
          <div
            key={a.id}
            className="bg-white rounded-2xl border-2 border-rose-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  <Flame className="w-3.5 h-3.5" /> Prioridad {a.priority} · {a.score}/100
                </span>
                <span className="text-xs text-slate-400">{formatDateCR(a.createdAt)}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">{a.title}</h3>
              {a.client && (
                <div className="text-xs text-slate-600">
                  <strong>{a.client.company}</strong> ({a.client.contactName || "Sin contacto"}) · Tel: {a.client.phone || "-"} · Est: {formatMoney(a.client.estimatedValue)}
                </div>
              )}
              {a.buyingSignals && (
                <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                  <strong>Señales detectadas:</strong> {a.buyingSignals}
                </div>
              )}
              {a.suggestedNextStep && (
                <div className="text-xs text-sky-900 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl">
                  <strong>Siguiente paso sugerido:</strong> {a.suggestedNextStep}
                </div>
              )}
            </div>

            <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
              {a.client && (
                <Link
                  href={`/cotizaciones?new=1&clientId=${a.client.id}`}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#0070C0] hover:bg-[#005a9e] text-white rounded-xl"
                >
                  <FileText className="w-4 h-4" /> Crear Proforma PDF
                </Link>
              )}
              <Link
                href={a.conversationId ? `/bandeja?id=${a.conversationId}` : "/bandeja"}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
              >
                <MessageSquare className="w-4 h-4" /> Tomar Chat (Bot pausado)
              </Link>
              <button
                onClick={() => resolveAlert(a, true)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                title="Cierra el aviso y vuelve a encender el Agente IA en ese chat"
              >
                <Bot className="w-4 h-4" /> Resuelto + Reactivar IA
              </button>
              <button
                onClick={() => resolveAlert(a, false)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
                title="Cierra el aviso pero deja el chat en modo manual"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Solo Marcar Resuelto
              </button>
            </div>
          </div>
        ))}
        {!loading && pending.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400">
            No hay avisos urgentes pendientes. Cuando un cliente muestre intención de compra por WhatsApp, audio o correo, aparecerá aquí automáticamente.
          </div>
        )}
      </div>

      {/* Resolved history */}
      {resolved.length > 0 && (
        <div className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Avisos atendidos / resueltos ({resolved.length})
            </h2>
            <button
              onClick={clearResolved}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpiar resueltos
            </button>
          </div>
          {resolved.map((a) => (
            <div
              key={a.id}
              className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3 text-xs text-slate-600"
            >
              <div>
                <span className="font-semibold text-slate-800">{a.title}</span>
                <div className="text-slate-500 mt-0.5">{a.buyingSignals}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => resolveAlert(a, false)}
                  className="text-xs font-semibold text-[#0070C0] hover:underline"
                >
                  Reabrir
                </button>
                <button
                  onClick={() => deleteAlert(a.id)}
                  className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg"
                  title="Eliminar aviso"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
