"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ShoppingBag,
  Search,
  MessageCircle,
  Plus,
  Minus,
  CheckCircle2,
  Loader2,
  Package,
  MapPin,
} from "lucide-react";
import { formatMoney, normalizeCRPhone } from "@/lib/format";

interface StoreCompany {
  id: string;
  brandName: string;
  companyName: string;
  primaryColor: string;
  accentColor: string;
  logoPath: string;
  address: string;
  phone: string;
  whatsapp: string;
  defaultCurrency: string;
  footerMotto: string;
}

interface StoreProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  price: number;
  wholesaleMinQty: number;
  wholesalePrice: number | null;
  stock: number;
  imageUrl: string;
}

export default function PublicStorePage() {
  const params = useParams<{ workspace: string }>();
  const workspace = params?.workspace || "default";

  const [company, setCompany] = useState<StoreCompany | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");

  useEffect(() => {
    fetch(`/api/public/store/${encodeURIComponent(workspace)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Catálogo no disponible.");
        setCompany(d.company);
        setProducts(d.products || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error cargando tienda."))
      .finally(() => setLoading(false));
  }, [workspace]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#0070C0]" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md space-y-2">
          <div className="text-3xl">🛍️</div>
          <h1 className="text-lg font-bold text-slate-900">Catálogo no disponible</h1>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const currency = company.defaultCurrency || "CRC";
  const categories = Array.from(new Set(products.map((p) => p.category || "General")));
  const filtered = products.filter((p) => {
    if (category !== "ALL" && (p.category || "General") !== category) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const cartItems = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const prod = products.find((p) => p.id === id)!;
      const unitPrice =
        prod.wholesalePrice && qty >= prod.wholesaleMinQty ? prod.wholesalePrice : prod.price;
      return { prod, qty, unitPrice, lineTotal: unitPrice * qty };
    })
    .filter((x) => x.prod);

  const cartTotal = cartItems.reduce((s, x) => s + x.lineTotal, 0);
  const cartCount = cartItems.reduce((s, x) => s + x.qty, 0);

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => {
      const next = Math.max(0, (prev[id] || 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  };

  const buildSummaryText = () =>
    cartItems
      .map((i) => `• ${i.qty}x ${i.prod.name} (${formatMoney(i.unitPrice, currency)} c/u)`)
      .join("\n");

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const summary = buildSummaryText();
      const res = await fetch(`/api/public/store/${encodeURIComponent(workspace)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          itemsSummary: summary,
          estimatedTotal: cartTotal,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo enviar.");
      setDoneMsg(d.message || "✅ Solicitud enviada.");
      setCart({});
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error enviando solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  const waNumber = normalizeCRPhone(company.whatsapp || company.phone);
  const waDirectUrl = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(
        `¡Hola ${company.brandName}! Quiero cotizar desde su catálogo web:\n${buildSummaryText()}\nTotal estimado: ${formatMoney(
          cartTotal,
          currency
        )}`
      )}`
    : "";

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header
        className="text-white py-6 px-4 shadow-md"
        style={{
          background: `linear-gradient(135deg, ${company.primaryColor || "#1e1046"} 0%, ${
            company.accentColor || "#0070C0"
          } 100%)`,
        }}
      >
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {company.logoPath ? (
              <img
                src={company.logoPath}
                alt={company.brandName}
                className="h-12 w-auto max-w-[140px] object-contain bg-white rounded-xl p-1.5"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
                <ShoppingBag className="w-6 h-6" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black tracking-tight">{company.brandName}</h1>
              {company.address && (
                <p className="text-xs text-white/85 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" /> {company.address}
                </p>
              )}
            </div>
          </div>
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs shadow-sm"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp {company.whatsapp || company.phone}
            </a>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-5">
        {doneMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{doneMsg}</span>
          </div>
        )}

        {/* Search & Categories */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto, modelo o SKU..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategory("ALL")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold ${
                category === "ALL" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"
              }`}
            >
              Todos ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold ${
                  category === cat ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const qty = cart[p.id] || 0;
            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col"
              >
                <div className="h-48 bg-slate-100 flex items-center justify-center overflow-hidden relative">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-12 h-12 text-slate-300" />
                  )}
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-white/90 text-slate-700 text-[10px] font-bold">
                    {p.category}
                  </span>
                  {p.wholesalePrice && (
                    <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold">
                      Mayoreo {p.wholesaleMinQty}+: {formatMoney(p.wholesalePrice, currency)}
                    </span>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <div className="font-extrabold text-slate-900 text-sm">{p.name}</div>
                  {p.description && <p className="text-xs text-slate-500 line-clamp-2">{p.description}</p>}
                  <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-lg font-black text-slate-900">{formatMoney(p.price, currency)}</div>
                      <div className="text-[10px] text-slate-400">SKU {p.sku} · {p.unit}</div>
                    </div>
                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => updateQty(p.id, 1)}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => updateQty(p.id, -1)}
                          className="p-1.5 rounded-lg bg-white text-slate-700"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-extrabold text-xs px-1">{qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(p.id, 1)}
                          className="p-1.5 rounded-lg bg-slate-900 text-white"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Sticky Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-2xl mx-auto bg-slate-900 text-white rounded-2xl p-3.5 shadow-2xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-300">{cartCount} artículos seleccionados</div>
            <div className="text-lg font-black">{formatMoney(cartTotal, currency)}</div>
          </div>
          <div className="flex items-center gap-2">
            {waDirectUrl && (
              <a
                href={waDirectUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs"
              >
                <MessageCircle className="w-4 h-4" /> Pedir por WhatsApp
              </a>
            )}
            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs"
            >
              Solicitar Proforma PDF
            </button>
          </div>
        </div>
      )}

      {/* Checkout / Inquiry Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitOrder}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-3.5 shadow-2xl text-xs"
          >
            <h2 className="text-base font-extrabold text-slate-900">Solicitar Proforma Oficial</h2>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 max-h-36 overflow-y-auto">
              {cartItems.map((i) => (
                <div key={i.prod.id} className="flex justify-between">
                  <span>{i.qty}x {i.prod.name}</span>
                  <strong>{formatMoney(i.lineTotal, currency)}</strong>
                </div>
              ))}
              <div className="pt-1 border-t border-slate-200 flex justify-between font-black text-sm">
                <span>Total estimado</span>
                <span>{formatMoney(cartTotal, currency)}</span>
              </div>
            </div>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Tu nombre o empresa *"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
            <input
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Tu WhatsApp (ej. 8888-8888) *"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Correo electrónico (opcional)"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Tallas, colores o dirección de envío (opcional)"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold disabled:opacity-50"
              >
                {submitting ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
