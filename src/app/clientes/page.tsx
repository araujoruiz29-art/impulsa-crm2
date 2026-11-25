"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Download,
  Upload,
  Phone,
  Mail,
  FileText,
  Trash2,
  Edit3,
  X,
  MessageCircle,
  MapPin,
} from "lucide-react";
import { CLIENT_SOURCES, CLIENT_STAGES, formatDateCR, formatMoney, normalizeCRPhone } from "@/lib/format";

interface ClientItem {
  id: string;
  code: string;
  company: string;
  contactName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  stage: string;
  source: string;
  tags: string;
  estimatedValue: number;
  notes: string;
  assignedTo: string;
  metaCampaign: string;
  _count?: { quotes: number; conversations: number; activities: number };
}

interface ClientDetail extends ClientItem {
  quotes: Array<{ id: string; number: number; total: number; currency: string; status: string; issueDate: string; jobTitle: string }>;
  activities: Array<{ id: string; type: string; title: string; description: string; createdAt: string; completed: boolean }>;
}

const EMPTY_FORM = {
  code: "",
  company: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  stage: "NUEVO",
  source: "WHATSAPP",
  tags: "",
  estimatedValue: 0,
  notes: "",
  assignedTo: "Jelsing R.",
  metaCampaign: "",
};

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [selectedDetail, setSelectedDetail] = useState<ClientDetail | null>(null);
  const [noteText, setNoteText] = useState("");

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (stageFilter !== "ALL") params.set("stage", stageFilter);
    if (sourceFilter !== "ALL") params.set("source", sourceFilter);
    const res = await fetch(`/api/clients?${params.toString()}`);
    const data = await res.json();
    setClients(data.clients || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageFilter, sourceFilter]);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (c: ClientItem) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      company: c.company,
      contactName: c.contactName,
      phone: c.phone,
      email: c.email,
      address: c.address,
      stage: c.stage,
      source: c.source,
      tags: c.tags,
      estimatedValue: c.estimatedValue,
      notes: c.notes,
      assignedTo: c.assignedTo,
      metaCampaign: c.metaCampaign,
    });
    setModalOpen(true);
  };

  const openDetail = async (id: string) => {
    const res = await fetch(`/api/clients/${id}`);
    const data = await res.json();
    setSelectedDetail(data.client || null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId ? `/api/clients/${editingId}` : "/api/clients";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setModalOpen(false);
        await load();
        if (selectedDetail && editingId === selectedDetail.id) {
          openDetail(editingId);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este cliente de la base de datos?")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (selectedDetail?.id === id) setSelectedDetail(null);
    load();
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetail || !noteText.trim()) return;
    await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedDetail.id,
        type: "NOTA",
        title: noteText.trim(),
        completed: true,
      }),
    });
    setNoteText("");
    openDetail(selectedDetail.id);
  };

  const exportCsv = () => {
    const headers = ["Codigo", "Empresa", "Contacto", "Telefono", "Correo", "Direccion", "Etapa", "Origen", "ValorEstimado", "Etiquetas"];
    const rows = clients.map((c) => [
      c.code,
      c.company,
      c.contactName,
      c.phone,
      c.email,
      c.address,
      c.stage,
      c.source,
      String(c.estimatedValue),
      c.tags,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clientes-caminante.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return;
    const parsed = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
      return {
        company: cols[0] || cols[1] || "Cliente Importado",
        contactName: cols[1] || "",
        phone: cols[2] || "",
        email: cols[3] || "",
        address: cols[4] || "",
        source: "MANUAL",
      };
    });
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clients: parsed }),
    });
    if (res.ok) {
      alert(`Se importaron ${parsed.length} cliente(s).`);
      load();
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Base de Datos de Clientes</h1>
          <p className="text-sm text-slate-500">
            Directorio centralizado con historial de proformas, WhatsApp, correos y seguimiento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">
            <Upload className="w-4 h-4 text-slate-500" />
            Importar CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />
          </label>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Exportar CSV
          </button>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#0070C0] hover:bg-[#005a9e] text-white rounded-xl shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="flex-1 flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por empresa, contacto, teléfono, correo o etiqueta..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800"
          >
            Buscar
          </button>
        </form>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
        >
          <option value="ALL">Todas las etapas</option>
          {CLIENT_STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
        >
          <option value="ALL">Todos los canales</option>
          {CLIENT_SOURCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Empresa / Contacto</th>
                <th className="px-4 py-3 font-semibold">WhatsApp y Correo</th>
                <th className="px-4 py-3 font-semibold">Etapa</th>
                <th className="px-4 py-3 font-semibold">Origen</th>
                <th className="px-4 py-3 font-semibold text-right">Valor Estimado</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => {
                const st = CLIENT_STAGES.find((s) => s.id === c.stage);
                const waNum = normalizeCRPhone(c.whatsapp || c.phone);
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-sky-50/40 cursor-pointer"
                    onClick={() => openDetail(c.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{c.company}</div>
                      <div className="text-xs text-slate-500">
                        {c.contactName || "Sin contacto"} {c.code ? `· ID: ${c.code}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" /> {c.phone || "-"}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-[#0070C0]" /> {c.email || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${st?.color || ""}`}>
                        {st?.label || c.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-slate-700">{c.source}</div>
                      {c.metaCampaign && (
                        <div className="text-[11px] text-purple-600 truncate max-w-[140px]">
                          {c.metaCampaign}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatMoney(c.estimatedValue)}
                      <div className="text-[11px] text-slate-400 font-normal">
                        {c._count?.quotes || 0} proforma(s)
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/cotizaciones?new=1&clientId=${c.id}`}
                          className="p-1.5 rounded-lg text-[#0070C0] hover:bg-sky-100"
                          title="Crear Proforma PDF"
                        >
                          <FileText className="w-4 h-4" />
                        </Link>
                        {waNum && (
                          <a
                            href={`https://wa.me/${waNum}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100"
                            title="Abrir WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No se encontraron clientes con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Detail Drawer */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div className="w-full max-w-xl bg-white h-full overflow-y-auto p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedDetail.company}</h2>
                <p className="text-sm text-slate-500">{selectedDetail.contactName}</p>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 block">Teléfono / WhatsApp</span>
                <span className="font-semibold text-slate-800">{selectedDetail.phone || "-"}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Correo</span>
                <span className="font-semibold text-slate-800 break-all">{selectedDetail.email || "-"}</span>
              </div>
              <div className="col-span-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-700">{selectedDetail.address || "Sin dirección"}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/cotizaciones?new=1&clientId=${selectedDetail.id}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#0070C0] text-white text-xs font-semibold py-2.5 px-3 rounded-xl"
              >
                <FileText className="w-4 h-4" /> Nueva Proforma
              </Link>
              {selectedDetail.phone && (
                <a
                  href={`https://wa.me/${normalizeCRPhone(selectedDetail.whatsapp || selectedDetail.phone)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 text-white text-xs font-semibold py-2.5 px-3 rounded-xl"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              )}
              <button
                onClick={() => openEdit(selectedDetail)}
                className="px-3 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Editar
              </button>
            </div>

            {/* Proformas del cliente */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">
                Proformas ({selectedDetail.quotes.length})
              </h3>
              <div className="space-y-2">
                {selectedDetail.quotes.map((qt) => (
                  <div
                    key={qt.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 text-xs"
                  >
                    <div>
                      <span className="font-bold text-rose-700">#{qt.number}</span>{" "}
                      <span className="font-semibold text-slate-800">{qt.jobTitle || "Proforma"}</span>
                      <div className="text-slate-500">{formatDateCR(qt.issueDate)} · {qt.status}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{formatMoney(qt.total, qt.currency)}</div>
                      <a
                        href={`/api/quotes/${qt.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#0070C0] font-semibold hover:underline"
                      >
                        Abrir PDF
                      </a>
                    </div>
                  </div>
                ))}
                {selectedDetail.quotes.length === 0 && (
                  <p className="text-xs text-slate-400">Sin proformas todavía.</p>
                )}
              </div>
            </div>

            {/* Notas e historial */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Historial y Notas</h3>
              <form onSubmit={addNote} className="flex gap-2 mb-3">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Agregar nota de llamada, tallas o acuerdo..."
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
                <button
                  type="submit"
                  className="px-3 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl"
                >
                  Guardar
                </button>
              </form>
              <div className="space-y-2">
                {selectedDetail.activities.map((a) => (
                  <div key={a.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-800">{a.title}</span>
                      <span className="text-[10px] text-slate-400">{formatDateCR(a.createdAt)}</span>
                    </div>
                    {a.description && <p className="text-slate-500 mt-1">{a.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? "Editar Cliente" : "Nuevo Cliente"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-600">Empresa / Institución *</label>
                <input
                  required
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Ej. MEP, Tico Frut..."
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Nombre del Contacto</label>
                <input
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  placeholder="Ej. Braulio Villegas"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Teléfono / WhatsApp (CR)</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="8679-1284"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Correo Electrónico</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contacto@empresa.cr"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Dirección</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="San Carlos, Alajuela"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Id. del Cliente / Cédula</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="3-101-XXXXXX"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Etapa</label>
                <select
                  value={form.stage}
                  onChange={(e) => setForm({ ...form, stage: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                >
                  {CLIENT_STAGES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Canal de Origen</label>
                <select
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                >
                  {CLIENT_SOURCES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Valor Estimado (₡)</label>
                <input
                  type="number"
                  value={form.estimatedValue}
                  onChange={(e) => setForm({ ...form, estimatedValue: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Etiquetas (separadas por coma)</label>
                <input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="uniformes, bordados, credito"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Notas</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold bg-[#0070C0] hover:bg-[#005a9e] text-white rounded-xl"
                >
                  {saving ? "Guardando..." : "Guardar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
