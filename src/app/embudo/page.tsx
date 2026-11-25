"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, MessageCircle, Plus, Trash2 } from "lucide-react";
import { CLIENT_STAGES, formatMoney, normalizeCRPhone } from "@/lib/format";

interface ClientCard {
  id: string;
  company: string;
  contactName: string;
  phone: string;
  whatsapp: string;
  stage: string;
  source: string;
  estimatedValue: number;
  tags: string;
  metaCampaign: string;
}

export default function EmbudoPage() {
  const [clients, setClients] = useState<ClientCard[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/clients");
    const data = await res.json();
    setClients(data.clients || []);
  };

  useEffect(() => {
    load();
  }, []);

  const moveStage = async (clientId: string, newStage: string) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, stage: newStage } : c))
    );
    await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
  };

  const deleteCard = async (c: ClientCard) => {
    if (!confirm(`¿Quitar "${c.company}" del Kanban? (No borra sus correos en Conversaciones).`)) return;
    setClients((prev) => prev.filter((item) => item.id !== c.id));
    await fetch(`/api/clients/${c.id}`, { method: "DELETE" });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Embudo de Ventas (Kanban)</h1>
          <p className="text-sm text-slate-500">
            Arrastra tarjetas entre etapas para dar seguimiento desde el primer contacto hasta el cierre.
          </p>
        </div>
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#0070C0] text-white rounded-xl hover:bg-[#005a9e]"
        >
          <Plus className="w-4 h-4" /> Gestionar Clientes
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {CLIENT_STAGES.map((stage) => {
          const cards = clients.filter((c) => c.stage === stage.id);
          const sum = cards.reduce((acc, c) => acc + (c.estimatedValue || 0), 0);

          return (
            <div
              key={stage.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggingId) {
                  moveStage(draggingId, stage.id);
                  setDraggingId(null);
                }
              }}
              className="w-72 shrink-0 bg-slate-100/80 border border-slate-200 rounded-2xl p-3 flex flex-col max-h-[75vh]"
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
                  <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">
                    {stage.label}
                  </h2>
                </div>
                <span className="text-xs font-bold bg-white px-2 py-0.5 rounded-full text-slate-600 border border-slate-200">
                  {cards.length}
                </span>
              </div>
              <div className="text-xs font-semibold text-[#0070C0] px-1 mb-3">
                {formatMoney(sum)}
              </div>

              <div className="space-y-2.5 overflow-y-auto flex-1 pr-0.5">
                {cards.map((c) => {
                  const wa = normalizeCRPhone(c.whatsapp || c.phone);
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDraggingId(c.id)}
                      className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs hover:shadow-md transition cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-sm text-slate-900 leading-tight">
                          {c.company}
                        </div>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {c.source}
                        </span>
                      </div>
                      {c.contactName && (
                        <div className="text-xs text-slate-500 mt-0.5">{c.contactName}</div>
                      )}
                      <div className="text-sm font-bold text-[#0070C0] mt-2">
                        {formatMoney(c.estimatedValue)}
                      </div>
                      {c.metaCampaign && (
                        <div className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded mt-1.5 truncate">
                          Meta: {c.metaCampaign}
                        </div>
                      )}

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                        <select
                          value={c.stage}
                          onChange={(e) => moveStage(c.id, e.target.value)}
                          className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700 max-w-[130px]"
                        >
                          {CLIENT_STAGES.map((st) => (
                            <option key={st.id} value={st.id}>{st.label}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/cotizaciones?new=1&clientId=${c.id}`}
                            className="p-1.5 rounded-lg text-[#0070C0] hover:bg-sky-50"
                            title="Nueva Proforma"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </Link>
                          {wa && (
                            <a
                              href={`https://wa.me/${wa}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => deleteCard(c)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                            title="Quitar tarjeta del Kanban"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {cards.length === 0 && (
                  <div className="text-xs text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-xl">
                    Arrastra un cliente aquí
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
