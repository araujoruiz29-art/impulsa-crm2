"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, Upload, Plus, Trash2, CheckCircle2, FileText } from "lucide-react";
import { formatDateCR } from "@/lib/format";

interface KnowledgeDoc {
  id: string;
  title: string;
  category: string;
  fileName: string;
  content: string;
  active: boolean;
  updatedAt: string;
}

export default function ConocimientoPage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Políticas y Precios");
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await fetch("/api/knowledge");
    const data = await res.json();
    setDocs(data.documents || []);
  };

  useEffect(() => {
    load();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFileName(file.name);
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
    setContent(text.slice(0, 15000));
    setMsg(`Archivo "${file.name}" leído. Revisa el contenido y haz clic en Guardar Documento.`);
    e.target.value = "";
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, fileName, content }),
      });
      if (res.ok) {
        setTitle("");
        setFileName("");
        setContent("");
        setMsg("✅ Documento cargado: el Agente de IA ya puede responder preguntas usando esta información.");
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (d: KnowledgeDoc) => {
    await fetch("/api/knowledge", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id, active: !d.active }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este documento de la base de conocimiento?")) return;
    await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-[#0070C0]" />
          Información y Documentos del Negocio
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Sube tus listas de precios, guías de tallas, políticas de bordado, tiempos de entrega o preguntas frecuentes. Todo documento activo entrena al instante a tu Agente de IA.
        </p>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {msg}
          </span>
          <button onClick={() => setMsg("")}>✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload / Add form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3.5 text-sm h-fit"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Cargar Nuevo Documento o Ficha</h2>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-[#0070C0] hover:bg-sky-100 rounded-xl text-xs font-bold cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Subir archivo
              <input
                type="file"
                accept=".txt,.md,.csv,.json"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
          <p className="text-[11px] text-slate-500">
            Admite archivos <code>.txt</code>, <code>.csv</code>, <code>.md</code>, <code>.json</code> o texto pegado directamente.
          </p>

          <div>
            <label className="text-xs font-semibold text-slate-600">Título del documento *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Tabla de precios bordados 2026"
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
            >
              <option value="Políticas y Precios">Políticas y Precios</option>
              <option value="Producción y Bordado">Producción y Bordado</option>
              <option value="Catálogo Técnico">Catálogo Técnico / Tallas</option>
              <option value="Pagos y Facturación">Pagos y Facturación</option>
              <option value="Preguntas Frecuentes">Preguntas Frecuentes</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Contenido *</label>
            <textarea
              required
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Pega aquí las reglas, garantías, tiempos de entrega, precios especiales o información que el asistente debe saber..."
              className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-[#0070C0] hover:bg-[#005a9e] text-white font-bold rounded-xl flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar en Base de Conocimiento"}
          </button>
        </form>

        {/* Loaded documents list */}
        <div className="lg:col-span-7 space-y-3">
          <h2 className="text-sm font-bold text-slate-700">
            Documentos cargados ({docs.length})
          </h2>
          {docs.map((d) => (
            <div key={d.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="w-4 h-4 text-[#0070C0]" />
                    <h3 className="font-bold text-slate-900 text-sm">{d.title}</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {d.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {d.fileName ? `${d.fileName} · ` : ""}Actualizado: {formatDateCR(d.updatedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleActive(d)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                      d.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {d.active ? "Activo en IA" : "Inactivo"}
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-100 max-h-36 overflow-y-auto">
                {d.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
