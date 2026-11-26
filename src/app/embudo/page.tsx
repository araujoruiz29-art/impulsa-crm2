"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  FileText,
  MessageCircle,
  Plus,
  Trash2,
  Search,
  LayoutGrid,
  List,
  Eye,
  X,
  Phone,
  Mail,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Save,
  Calendar,
} from "lucide-react";
import { CLIENT_STAGES, formatDateCR, formatMoney, normalizeCRPhone } from "@/lib/format";

interface ClientCard {
  id: string;
  company: string;
  contactName: string;
  phone: string;
  whatsapp: string;
  email: string;
  stage: string;
  source: string;
  estimatedValue: number;
  tags: string;
  notes: string;
  metaCampaign: string;
}

interface ClientFullDetail extends ClientCard {
  address: string;
  assignedTo: string;
  quotes: Array<{
    id: string;
    number: number;
    jobTitle: string;
    total: number;
    currency: string;
    status: string;
    issueDate: string;
  }>;
  conversations: Array<{
    id: string;
    channel: string;
    subject: string;
    lastMessageAt: string;
    messages: Array<{
      id: string;
      direction: string;
      senderName: string;
      body: string;
      createdAt: string;
    }>;
  }>;
  activities: Array<{
    id: string;
    type: string;
    title: string;
    dueDate: string | null;
    completed: boolean;
  }>;
}

function extractAiSummary(notes: string): string {
  if (!notes) return "";
  const m = notes.match(/\[Resumen IA\]\s*([^\n]+)/);
  if (m?.[1]) return m[1].trim();
  const clean = notes.replace(/Capturado automáticamente.*/i, "").trim();
  return clean.slice(0, 110);
}

export default function EmbudoPage() {
  const [clients, setClients] = useState<ClientCard[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [stageFilter, setStageFilter] = useState("ALL");

  // Preview drawer state
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ClientFullDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editValue, setEditValue] = useState<string>("0");
  const [editTags, setEditTags] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [savingPreview, setSavingPreview] = useState(false);

  const boardRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    const res = await fetch("/api/clients?contactType=CLIENTE");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json();
    setClients(Array.isArray(data.clients) ? data.clients : []);
  };

  useEffect(() => {
    load();
  }, []);

  const openPreview = async (clientId: string) => {
    setPreviewId(clientId);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      const data = await res.json();
      if (res.ok && data.client) {
        setPreviewData(data.client);
        setEditValue(String(data.client.estimatedValue || 0));
        setEditTags(data.client.tags || "");
        setEditNotes(data.client.notes || "");
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const moveStage = async (clientId: string, newStage: string) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, stage: newStage } : c))
    );
    if (previewData && previewData.id === clientId) {
      setPreviewData({ ...previewData, stage: newStage });
    }
    await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
  };

  const savePreviewDetails = async () => {
    if (!previewData) return;
    setSavingPreview(true);
    try {
      const numVal = Number(editValue) || 0;
      const res = await fetch(`/api/clients/${previewData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimatedValue: numVal,
          tags: editTags,
          notes: editNotes,
        }),
      });
      if (res.ok) {
        setClients((prev) =>
          prev.map((c) =>
            c.id === previewData.id
              ? { ...c, estimatedValue: numVal, tags: editTags, notes: editNotes }
              : c
          )
        );
        setPreviewData({
          ...previewData,
          estimatedValue: numVal,
          tags: editTags,
          notes: editNotes,
        });
      }
    } finally {
      setSavingPreview(false);
    }
  };

  const deleteCard = async (c: ClientCard) => {
    if (!confirm(`¿Quitar "${c.company}" del Kanban? (No borra sus correos en Conversaciones).`)) return;
    setClients((prev) => prev.filter((item) => item.id !== c.id));
    if (previewId === c.id) {
      setPreviewId(null);
      setPreviewData(null);
    }
    await fetch(`/api/clients/${c.id}`, { method: "DELETE" });
  };

  const scrollBoard = (dir: -1 | 1) => {
    boardRef.current?.scrollBy({ left: dir * 340, behavior: "smooth" });
  };

  const filteredClients = clients.filter((c) => {
    if (stageFilter !== "ALL" && c.stage !== stageFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return `${c.company} ${c.contactName} ${c.tags} ${c.phone} ${c.notes}`
      .toLowerCase()
      .includes(q);
  });

  const visibleStages = CLIENT_STAGES.filter((st) => {
    if (stageFilter !== "ALL" && st.id !== stageFilter) return false;
    if (hideEmpty) {
      return filteredClients.some((c) => c.stage === st.id);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Embudo de Ventas (Kanban)</h1>
          <p className="text-sm text-slate-500">
            Haz clic en cualquier tarjeta para previsualizar el resumen IA, chat y proformas — o arrastra entre etapas.
          </p>
        </div>
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#0070C0] text-white rounded-xl hover:bg-[#005a9e] shrink-0"
        >
          <Plus className="w-4 h-4" /> Gestionar Clientes
        </Link>
      </div>

      {/* Controls Bar: Search, View Switch, Hide Empty, Horizontal Scroll Arrows */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa, contacto, etiqueta o resumen..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0070C0]/25"
            />
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                viewMode === "kanban"
                  ? "bg-white text-[#22115d] shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                viewMode === "list"
                  ? "bg-white text-[#22115d] shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <List className="w-3.5 h-3.5" /> Lista completa
            </button>
          </div>

          {viewMode === "kanban" && (
            <>
              <button
                type="button"
                onClick={() => setHideEmpty(!hideEmpty)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                  hideEmpty
                    ? "bg-indigo-50 border-indigo-300 text-[#22115d]"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                title="Oculta columnas vacías para ver solo tus etapas con negocios activos"
              >
                <Eye className="w-3.5 h-3.5" />
                {hideEmpty ? "Mostrando solo con negocios" : "Ocultar columnas vacías"}
              </button>

              <div className="hidden sm:inline-flex items-center gap-1 ml-auto">
                <button
                  type="button"
                  onClick={() => scrollBoard(-1)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                  title="Desplazar Kanban a la izquierda"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollBoard(1)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                  title="Desplazar Kanban a la derecha"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Stage Summary Pills (Quick Filter) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStageFilter("ALL")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
              stageFilter === "ALL"
                ? "bg-[#22115d] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todas ({clients.length})
          </button>
          {CLIENT_STAGES.map((st) => {
            const count = clients.filter((c) => c.stage === st.id).length;
            const active = stageFilter === st.id;
            return (
              <button
                type="button"
                key={st.id}
                onClick={() => setStageFilter(active ? "ALL" : st.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  active
                    ? "bg-[#0070C0] text-white"
                    : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${active ? "bg-white" : st.dot}`} />
                {st.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW 1: KANBAN BOARD */}
      {viewMode === "kanban" && (
        <div
          ref={boardRef}
          className={`pb-4 ${
            visibleStages.length <= 4
              ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5"
              : "flex gap-3.5 overflow-x-auto snap-x"
          }`}
        >
          {visibleStages.map((stage) => {
            const cards = filteredClients.filter((c) => c.stage === stage.id);
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
                className={`${
                  visibleStages.length <= 4 ? "w-full" : "w-[260px] shrink-0 snap-start"
                } bg-slate-100/80 border border-slate-200 rounded-2xl p-3 flex flex-col min-h-[380px] max-h-[76vh]`}
              >
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${stage.dot}`} />
                    <h2 className="text-xs font-bold uppercase tracking-wide text-slate-800 truncate">
                      {stage.label}
                    </h2>
                  </div>
                  <span className="text-xs font-bold bg-white px-2 py-0.5 rounded-full text-slate-700 border border-slate-200 shrink-0">
                    {cards.length}
                  </span>
                </div>
                <div className="text-xs font-bold text-[#0070C0] px-1 mb-2.5">
                  {formatMoney(sum)}
                </div>

                <div className="space-y-2.5 overflow-y-auto flex-1 pr-0.5">
                  {cards.map((c) => {
                    const wa = normalizeCRPhone(c.whatsapp || c.phone);
                    const summary = extractAiSummary(c.notes);
                    const tagList = (c.tags || "")
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .slice(0, 3);
                    const isSelected = previewId === c.id;

                    return (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={() => setDraggingId(c.id)}
                        onClick={() => openPreview(c.id)}
                        className={`bg-white rounded-xl p-3 border shadow-xs hover:shadow-md transition cursor-pointer ${
                          isSelected
                            ? "border-[#0070C0] ring-2 ring-[#0070C0]/20"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-sm text-slate-900 leading-snug line-clamp-2">
                            {c.company}
                          </div>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                            {c.source}
                          </span>
                        </div>
                        {c.contactName && c.contactName !== c.company && (
                          <div className="text-xs text-slate-500 mt-0.5 truncate">{c.contactName}</div>
                        )}
                        {summary && (
                          <p className="text-[11px] text-slate-600 mt-1.5 line-clamp-2 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100">
                            {summary}
                          </p>
                        )}
                        {tagList.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tagList.map((tg) => (
                              <span
                                key={tg}
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-[#22115d]"
                              >
                                {tg}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="text-sm font-bold text-[#0070C0] mt-2">
                          {formatMoney(c.estimatedValue)}
                        </div>

                        <div
                          className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={c.stage}
                            onChange={(e) => moveStage(c.id, e.target.value)}
                            className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700 max-w-[115px]"
                          >
                            {CLIENT_STAGES.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => openPreview(c.id)}
                              className="p-1.5 rounded-lg text-indigo-700 hover:bg-indigo-50"
                              title="Previsualizar detalles"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
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
                              type="button"
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
          {visibleStages.length === 0 && (
            <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-400">
              No hay negocios para mostrar con los filtros actuales.
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: FULL TABLE / LIST VIEW (Zero horizontal scrolling!) */}
      {viewMode === "list" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Cliente / Resumen IA</th>
                  <th className="px-4 py-3 font-semibold">Etapa</th>
                  <th className="px-4 py-3 font-semibold">Etiquetas</th>
                  <th className="px-4 py-3 font-semibold text-right">Valor Estimado</th>
                  <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((c) => {
                  const summary = extractAiSummary(c.notes);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => openPreview(c.id)}
                      className="hover:bg-sky-50/40 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{c.company}</div>
                        <div className="text-xs text-slate-500">
                          {c.contactName || "-"} · {c.phone || c.email || c.source}
                        </div>
                        {summary && (
                          <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">{summary}</div>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={c.stage}
                          onChange={(e) => moveStage(c.id, e.target.value)}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                        >
                          {CLIENT_STAGES.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(c.tags || "")
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean)
                            .slice(0, 3)
                            .map((tg) => (
                              <span
                                key={tg}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-[#22115d]"
                              >
                                {tg}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#0070C0]">
                        {formatMoney(c.estimatedValue)}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openPreview(c.id)}
                            className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-[#22115d] rounded-lg hover:bg-indigo-100"
                          >
                            Ver
                          </button>
                          <Link
                            href={`/cotizaciones?new=1&clientId=${c.id}`}
                            className="p-1.5 text-[#0070C0] hover:bg-sky-50 rounded-lg"
                            title="Nueva Proforma"
                          >
                            <FileText className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => deleteCard(c)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                            title="Quitar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">
                      No hay clientes en el embudo todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SLIDE-OVER PREVIEW DRAWER (Full Client, AI Summary, Chat & Quotes Preview) */}
      {previewId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div
            className="flex-1"
            onClick={() => {
              setPreviewId(null);
              setPreviewData(null);
            }}
          />
          <div className="w-full max-w-lg bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#0070C0]">
                  Previsualización de Negocio
                </div>
                <h2 className="text-base font-extrabold text-slate-900 truncate">
                  {previewData?.company || "Cargando..."}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreviewId(null);
                  setPreviewData(null);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {previewLoading || !previewData ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                Cargando ficha completa...
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/cotizaciones?new=1&clientId=${previewData.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0070C0] hover:bg-[#005a9e] text-white font-bold rounded-xl"
                  >
                    <FileText className="w-3.5 h-3.5" /> Nueva Proforma PDF
                  </Link>
                  <Link
                    href="/bandeja"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Ver en Conversaciones
                  </Link>
                  {normalizeCRPhone(previewData.whatsapp || previewData.phone) && (
                    <a
                      href={`https://wa.me/${normalizeCRPhone(previewData.whatsapp || previewData.phone)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50"
                    >
                      WhatsApp <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Contact Info */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-800 text-sm">
                    {previewData.contactName || previewData.company}
                  </div>
                  <div className="flex flex-wrap gap-3 text-slate-600">
                    {previewData.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" /> {previewData.phone}
                      </span>
                    )}
                    {previewData.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" /> {previewData.email}
                      </span>
                    )}
                  </div>
                  <div className="pt-2 flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Etapa Kanban:</span>
                    <select
                      value={previewData.stage}
                      onChange={(e) => moveStage(previewData.id, e.target.value)}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-800"
                    >
                      {CLIENT_STAGES.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Editable Value, Tags & AI Summary */}
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-3">
                  <div className="font-bold text-[#22115d] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Valor, Etiquetas y Resumen IA
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">Valor estimado (₡)</label>
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">Etiquetas (comas)</label>
                      <input
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        placeholder="Uniformes, SICOP, Calzado"
                        className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Resumen IA y Notas</label>
                    <textarea
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingPreview}
                    onClick={savePreviewDetails}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#22115d] text-white font-bold rounded-lg"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingPreview ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>

                {/* Recent Messages */}
                <div className="space-y-2">
                  <div className="font-bold text-slate-800">Últimos mensajes del chat</div>
                  {previewData.conversations.length === 0 ? (
                    <div className="text-slate-400 bg-slate-50 p-3 rounded-xl">
                      Sin conversaciones registradas aún.
                    </div>
                  ) : (
                    previewData.conversations.slice(0, 2).map((conv) => (
                      <div key={conv.id} className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="text-[10px] font-bold uppercase text-slate-500">
                          {conv.channel} · {formatDateCR(conv.lastMessageAt)}
                        </div>
                        {[...conv.messages].reverse().map((m) => (
                          <div
                            key={m.id}
                            className={`p-2 rounded-lg text-[11px] ${
                              m.direction === "OUTBOUND"
                                ? "bg-sky-100 text-sky-950 ml-4"
                                : "bg-white border border-slate-200 text-slate-800 mr-4"
                            }`}
                          >
                            <div className="font-bold text-[10px] opacity-75">{m.senderName}</div>
                            <div className="whitespace-pre-wrap line-clamp-3">{m.body}</div>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>

                {/* Quotes */}
                <div className="space-y-2">
                  <div className="font-bold text-slate-800">
                    Proformas emitidas ({previewData.quotes.length})
                  </div>
                  {previewData.quotes.length === 0 ? (
                    <div className="text-slate-400 bg-slate-50 p-3 rounded-xl">
                      Sin proformas todavía.
                    </div>
                  ) : (
                    previewData.quotes.map((q) => (
                      <div
                        key={q.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            #{q.number} · {q.jobTitle || "Proforma"}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatDateCR(q.issueDate)} · {q.status}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-[#0070C0]">
                            {formatMoney(q.total, q.currency)}
                          </span>
                          <a
                            href={`/api/quotes/${q.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-[#0070C0] hover:bg-sky-50"
                          >
                            PDF
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Scheduled Tasks */}
                {previewData.activities.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#0070C0]" />
                      Actividades y Agenda ({previewData.activities.length})
                    </div>
                    {previewData.activities.slice(0, 5).map((a) => (
                      <div
                        key={a.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <span className={a.completed ? "line-through text-slate-400" : "font-semibold text-slate-800"}>
                          {a.title}
                        </span>
                        {a.dueDate && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                            {formatDateCR(a.dueDate)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
