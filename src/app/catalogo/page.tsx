"use client";

import React, { useEffect, useState } from "react";
import { Plus, Search, Edit3, Trash2, X, Package, Camera } from "lucide-react";
import { formatMoney, PRODUCT_CATEGORIES } from "@/lib/format";
import { ShoeVisionModal } from "@/components/ShoeVisionModal";

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  price: number;
  cost: number;
  wholesaleMinQty: number;
  wholesalePrice: number | null;
  active: boolean;
}

const EMPTY_PROD = {
  sku: "",
  name: "",
  category: "Uniformes",
  description: "",
  unit: "Unidad",
  price: 0,
  cost: 0,
  wholesaleMinQty: 12,
  wholesalePrice: "",
};

export default function CatalogoPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [visionOpen, setVisionOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_PROD);

  const load = async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (cat !== "ALL") params.set("category", cat);
    const res = await fetch(`/api/products?${params.toString()}`);
    const data = await res.json();
    setProducts(data.products || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_PROD);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      sku: p.sku,
      name: p.name,
      category: p.category,
      description: p.description,
      unit: p.unit,
      price: p.price,
      cost: p.cost,
      wholesaleMinQty: p.wholesaleMinQty,
      wholesalePrice: p.wholesalePrice ? String(p.wholesalePrice) : "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/products/${editingId}` : "/api/products";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setModalOpen(false);
      load();
    } else {
      const err = await res.json();
      alert(err.error || "Error guardando producto");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este producto del catálogo?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catálogo de Productos y Servicios</h1>
          <p className="text-sm text-slate-500">
            Uniformes, bordados, promocionales, deportivos y zapatos de seguridad · Precios en Colones (₡) con IVA 13% incluido.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setVisionOpen(true)}
            className="btn-brand inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl shadow-sm"
          >
            <Camera className="w-4 h-4" /> Buscar por Foto (Stock Web)
          </button>
          {products.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm(`¿Vaciar los ${products.length} artículos del catálogo?`)) return;
                await fetch("/api/cleanup", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ clearProducts: true }),
                });
                load();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl shadow-xs"
            >
              <Trash2 className="w-4 h-4" /> Vaciar Catálogo
            </button>
          )}
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#0070C0] hover:bg-[#005a9e] text-white rounded-xl shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nuevo Producto
          </button>
        </div>
      </div>

      {/* Category pills + search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCat("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              cat === "ALL" ? "bg-[#0070C0] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Todos
          </button>
          {PRODUCT_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                cat === c ? "bg-[#0070C0] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar producto, código SKU o especificación..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl"
            />
          </div>
          <button type="submit" className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-xl">
            Buscar
          </button>
        </form>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {products.map((p) => {
          const margin = p.price > 0 && p.cost > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : null;
          return (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-[#0070C0]">
                    {p.category}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{p.sku}</span>
                </div>
                <h3 className="font-bold text-slate-900 mt-2.5 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-slate-400 shrink-0" />
                  {p.name}
                </h3>
                <p className="text-xs text-slate-500 whitespace-pre-line mt-1.5 line-clamp-3">
                  {p.description || "Sin descripción detallada."}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400">Precio unitario (IVA incl.)</div>
                    <div className="text-lg font-bold text-slate-900">
                      {formatMoney(p.price)} <span className="text-xs font-normal text-slate-400">/ {p.unit}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>
                    {p.wholesalePrice
                      ? `Mayoreo (${p.wholesaleMinQty}+): ${formatMoney(p.wholesalePrice)}`
                      : "Sin tarifa mayoreo"}
                  </span>
                  {margin !== null && (
                    <span className="text-emerald-700 font-semibold">Margen ~{margin}%</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? "Editar Producto" : "Nuevo Producto en Catálogo"}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Nombre del producto / servicio *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej. CAMISA POLO CORPORATIVA CON BORDADO"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Código SKU</label>
                <input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="UNI-POL-002"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Categoría</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                >
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Precio Unitario ₡ (IVA 13% incl.) *</label>
                <input
                  type="number"
                  required
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Costo interno ₡</label>
                <input
                  type="number"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Precio Mayoreo ₡ (opcional)</label>
                <input
                  type="number"
                  value={form.wholesalePrice}
                  onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Cantidad mínima mayoreo</label>
                <input
                  type="number"
                  value={form.wholesaleMinQty}
                  onChange={(e) => setForm({ ...form, wholesaleMinQty: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">
                  Especificaciones (aparecen en líneas extra de la Proforma PDF)
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ej. MATERIAL PVC NORMAL&#10;SUELA AMARILLA&#10;CAÑA NEGRA"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-200 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-[#0070C0] text-white rounded-xl hover:bg-[#005a9e]"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ShoeVisionModal open={visionOpen} onClose={() => setVisionOpen(false)} />
    </div>
  );
}
