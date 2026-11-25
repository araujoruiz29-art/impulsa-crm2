"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, CheckCircle2, FileText, MessageSquare, Flame, RefreshCw } from "lucide-react";
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

  const toggleResolved = async (a: AlertItem) => {
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, resolved: !a.resolved, read: true }),
    });
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
                onClick={() => toggleResolved(a)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Marcar Atendido
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
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Avisos atendidos ({resolved.length})
          </h2>
          {resolved.map((a) => (
            <div
              key={a.id}
              className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 flex items-center justify-between text-xs text-slate-600"
            >
              <div>
                <span className="font-semibold text-slate-800">{a.title}</span>
                <div className="text-slate-500 mt-0.5">{a.buyingSignals}</div>
              </div>
              <button
                onClick={() => toggleResolved(a)}
                className="text-xs font-semibold text-[#0070C0] hover:underline shrink-0"
              >
                Reabrir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
