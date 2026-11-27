"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Trash2,
  FileText,
  Download,
  Mail,
  MessageCircle,
  Sparkles,
  Copy,
  CheckCircle2,
  Search,
  ExternalLink,
  X,
  Edit3,
} from "lucide-react";
import {
  calculateQuoteTotals,
  formatDateCR,
  formatMoney,
  QUOTE_STATUSES,
  sanitizeFilename,
  TAX_MODES,
} from "@/lib/format";

interface ClientOpt {
  id: string;
  code: string;
  company: string;
  contactName: string;
  address: string;
  phone: string;
  email: string;
}

interface ProductOpt {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  price: number;
  wholesaleMinQty: number;
  wholesalePrice: number | null;
}

interface QuoteLine {
  productId?: string;
  quantity: number;
  title: string;
  description: string;
  unitPrice: number;
}

interface QuoteRecord {
  id: string;
  number: number;
  clientId: string | null;
  clientCode: string;
  clientCompany: string;
  clientContact: string;
  clientAddress: string;
  clientPhone: string;
  clientEmail: string;
  seller: string;
  jobTitle: string;
  paymentTerms: string;
  validity: string;
  currency: string;
  taxMode: string;
  taxRate: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  status: string;
  notes: string;
  issueDate: string;
  sentVia: string;
  items: QuoteLine[];
}

function CotizacionesInner() {
  const searchParams = useSearchParams();
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Builder state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiExtracting, setAiExtracting] = useState(false);

  // Send modal state
  const [sendTarget, setSendTarget] = useState<QuoteRecord | null>(null);
  const [sendChannel, setSendChannel] = useState<"EMAIL" | "WHATSAPP" | "BOTH">("EMAIL");
  const [sendMessage, setSendMessage] = useState("");
  const [emailAccounts, setEmailAccounts] = useState<Array<{ id: string; label: string; email: string; isDefault: boolean }>>([]);
  const [fromAccountId, setFromAccountId] = useState("");
  const [sending, setSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{ text: string; waLink?: string; waAppLink?: string } | null>(null);

  const [form, setForm] = useState({
    clientId: "",
    clientCode: "",
    clientCompany: "",
    clientContact: "",
    clientAddress: "",
    clientPhone: "",
    clientEmail: "",
    seller: "Jelsing R.",
    jobTitle: "UNIFORMES CORPORATIVOS",
    paymentTerms: "CONTADO",
    validity: "30 días",
    currency: "CRC",
    taxMode: "IVA_INCLUIDO",
    taxRate: 0.13,
    discountAmount: 0,
    notes: "",
  });

  const [lines, setLines] = useState<QuoteLine[]>([
    { quantity: 1, title: "", description: "", unitPrice: 0 },
  ]);

  const loadAll = async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    const [qRes, cRes, pRes, eRes] = await Promise.all([
      fetch(`/api/quotes?${params.toString()}`),
      fetch("/api/clients"),
      fetch("/api/products"),
      fetch("/api/email-accounts"),
    ]);
    const [qData, cData, pData, eData] = await Promise.all([
      qRes.json(),
      cRes.json(),
      pRes.json(),
      eRes.json(),
    ]);
    setQuotes(qData.quotes || []);
    setClients(cData.clients || []);
    setProducts(pData.products || []);
    const accs = eData.accounts || [];
    setEmailAccounts(accs);
    if (!fromAccountId && accs.length > 0) {
      const def = accs.find((a: { isDefault: boolean }) => a.isDefault) || accs[0];
      setFromAccountId(def.id);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      const clientIdParam = searchParams.get("clientId") || "";
      const aiDraftRaw = searchParams.get("aiText") || "";
      openNewBuilder(clientIdParam, aiDraftRaw);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, clients.length]);

  const openNewBuilder = (preClientId = "", preAiText = "") => {
    setEditingQuoteId(null);
    const found = clients.find((c) => c.id === preClientId);
    setForm({
      clientId: found?.id || "",
      clientCode: found?.code || "",
      clientCompany: found?.company || "",
      clientContact: found?.contactName || "",
      clientAddress: found?.address || "",
      clientPhone: found?.phone || "",
      clientEmail: found?.email || "",
      seller: "Jelsing R.",
      jobTitle: "UNIFORMES CORPORATIVOS",
      paymentTerms: "CONTADO",
      validity: "30 días",
      currency: "CRC",
      taxMode: "IVA_INCLUIDO",
      taxRate: 0.13,
      discountAmount: 0,
      notes: "",
    });
    setLines([{ quantity: 1, title: "", description: "", unitPrice: 0 }]);
    setAiText(preAiText);
    setBuilderOpen(true);
    if (preAiText) {
      setTimeout(() => runAiExtract(preAiText), 150);
    }
  };

  const openEditBuilder = (qt: QuoteRecord, duplicate = false) => {
    setEditingQuoteId(duplicate ? null : qt.id);
    setForm({
      clientId: qt.clientId || "",
      clientCode: qt.clientCode,
      clientCompany: qt.clientCompany,
      clientContact: qt.clientContact,
      clientAddress: qt.clientAddress,
      clientPhone: qt.clientPhone,
      clientEmail: qt.clientEmail,
      seller: qt.seller,
      jobTitle: qt.jobTitle,
      paymentTerms: qt.paymentTerms,
      validity: qt.validity,
      currency: qt.currency,
      taxMode: qt.taxMode,
      taxRate: qt.taxRate,
      discountAmount: qt.discountAmount,
      notes: qt.notes,
    });
    setLines(
      qt.items.length > 0
        ? qt.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            title: i.title,
            description: i.description,
            unitPrice: i.unitPrice,
          }))
        : [{ quantity: 1, title: "", description: "", unitPrice: 0 }]
    );
    setBuilderOpen(true);
  };

  const handleSelectClient = (clientId: string) => {
    const c = clients.find((item) => item.id === clientId);
    if (!c) {
      setForm((f) => ({ ...f, clientId: "" }));
      return;
    }
    setForm((f) => ({
      ...f,
      clientId: c.id,
      clientCode: c.code,
      clientCompany: c.company,
      clientContact: c.contactName,
      clientAddress: c.address,
      clientPhone: c.phone,
      clientEmail: c.email,
    }));
  };

  const handleAddProductLine = (productId: string) => {
    const p = products.find((item) => item.id === productId);
    if (!p) return;
    setLines((prev) => {
      const cleaned =
        prev.length === 1 && !prev[0].title && prev[0].unitPrice === 0 ? [] : prev;
      return [
        ...cleaned,
        {
          productId: p.id,
          quantity: 1,
          title: p.name,
          description: p.description,
          unitPrice: p.price,
        },
      ];
    });
  };

  const updateLine = (idx: number, patch: Partial<QuoteLine>) => {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== idx) return line;
        const next = { ...line, ...patch };
        // Auto-apply wholesale price when product has wholesale threshold
        if (patch.quantity !== undefined && next.productId) {
          const prod = products.find((p) => p.id === next.productId);
          if (prod && prod.wholesalePrice) {
            next.unitPrice =
              next.quantity >= prod.wholesaleMinQty ? prod.wholesalePrice : prod.price;
          }
        }
        return next;
      })
    );
  };

  const runAiExtract = async (overrideText?: string) => {
    const txt = (overrideText ?? aiText).trim();
    if (!txt) return;
    setAiExtracting(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extract_quote", text: txt }),
      });
      const data = await res.json();
      if (data.draft?.items?.length) {
        setLines(data.draft.items);
        setForm((f) => ({
          ...f,
          jobTitle: data.draft.jobTitle || f.jobTitle,
          taxMode: data.draft.taxMode || f.taxMode,
        }));
      }
    } finally {
      setAiExtracting(false);
    }
  };

  const totals = calculateQuoteTotals(lines, form.taxMode, form.taxRate, form.discountAmount);

  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.title.trim());
    if (validLines.length === 0) {
      alert("Agrega al menos una línea con descripción.");
      return;
    }
    setSaving(true);
    try {
      const url = editingQuoteId ? `/api/quotes/${editingQuoteId}` : "/api/quotes";
      const method = editingQuoteId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: validLines }),
      });
      if (res.ok) {
        setBuilderOpen(false);
        await loadAll();
      } else {
        const err = await res.json();
        alert(err.error || "Error guardando proforma");
      }
    } finally {
      setSaving(false);
    }
  };

  const updateQuoteStatus = async (id: string, status: string) => {
    await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadAll();
  };

  const deleteQuote = async (id: string) => {
    if (!confirm("¿Eliminar esta Factura Proforma?")) return;
    await fetch(`/api/quotes/${id}`, { method: "DELETE" });
    loadAll();
  };

  const openSendModal = (qt: QuoteRecord, channel: "EMAIL" | "WHATSAPP" | "BOTH") => {
    setSendTarget(qt);
    setSendChannel(channel);
    setSendFeedback(null);
    setSendMessage(
      `Estimado(a) ${qt.clientContact || qt.clientCompany},\n\nAdjunto Factura Proforma #${qt.number} solicitada para su revisión (${qt.jobTitle || "Cotización"}) por un total de ${formatMoney(qt.total, qt.currency)}.\n\nQuedamos atentos a cualquier consulta.\nSaludos,\n${qt.seller} · Caminante Corporativo`
    );
  };

  const executeSend = async () => {
    if (!sendTarget) return;
    setSending(true);
    setSendFeedback(null);
    try {
      const res = await fetch(`/api/quotes/${sendTarget.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: sendChannel,
          message: sendMessage,
          fromAccountId: fromAccountId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendFeedback({ text: data.error || "No se pudo enviar." });
      } else {
        const waInfo = data.results?.whatsapp;
        const emailInfo = data.results?.email;
        const msgs: string[] = [];
        if (emailInfo?.info) msgs.push(emailInfo.info);
        if (waInfo?.info) msgs.push(waInfo.info);
        setSendFeedback({
          text: msgs.join(" ") || "Proforma enviada y registrada en el historial del cliente.",
          waLink: waInfo?.webLink,
          waAppLink: waInfo?.appLink,
        });
        loadAll();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Facturas Proforma y Cotizaciones PDF</h1>
          <p className="text-sm text-slate-500">
            Reemplazo completo de tu Excel con macros: formato oficial Caminante Corporativo, colones (₡) con IVA 13% incluido o desglosado, PDF automático y envío en 1 clic.
          </p>
        </div>
        <button
          onClick={() => openNewBuilder()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold bg-[#0070C0] hover:bg-[#005a9e] text-white rounded-xl shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nueva Proforma
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadAll();
          }}
          className="flex-1 flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por número de proforma (ej. 1408), cliente o trabajo..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl"
            />
          </div>
          <button type="submit" className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-xl">
            Buscar
          </button>
        </form>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
        >
          <option value="ALL">Todos los estados</option>
          {QUOTE_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">N.º</th>
                <th className="px-4 py-3 font-semibold">Cliente / Trabajo</th>
                <th className="px-4 py-3 font-semibold">Fecha & Impuesto</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotes.map((qt) => {
                const filename = `${qt.number}-${sanitizeFilename(qt.clientCompany)}.pdf`;
                return (
                  <tr key={qt.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3.5 font-bold text-rose-700">#{qt.number}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{qt.clientCompany}</div>
                      <div className="text-xs text-slate-500">
                        {qt.clientContact || "-"} · {qt.jobTitle || "Proforma"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <div className="text-slate-700 font-medium">{formatDateCR(qt.issueDate)}</div>
                      <div className="text-slate-400">
                        {qt.taxMode === "IVA_INCLUIDO"
                          ? "IVA 13% Incluido"
                          : qt.taxMode === "DESGLOSADO"
                          ? "IVA 13% Desglosado"
                          : "Exonerado"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={qt.status}
                        onChange={(e) => updateQuoteStatus(qt.id, e.target.value)}
                        className="text-xs font-semibold px-2 py-1 rounded-lg border border-slate-200 bg-white"
                      >
                        {QUOTE_STATUSES.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                      {qt.sentVia && (
                        <div className="text-[10px] text-emerald-700 mt-0.5">
                          Enviado: {qt.sentVia}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900">
                      {formatMoney(qt.total, qt.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        {(qt as QuoteRecord & { portalPath?: string }).portalPath && (
                          <button
                            type="button"
                            onClick={() => {
                              const url = `${window.location.origin}${(qt as QuoteRecord & { portalPath?: string }).portalPath}`;
                              navigator.clipboard?.writeText(url);
                              alert(`🔗 Enlace del Portal Cliente copiado:\n${url}\n\nEl cliente puede aprobar en 1 clic o subir su comprobante SINPE.`);
                            }}
                            className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#22115d] font-bold text-[11px]"
                            title="Copiar enlace interactivo del Portal Cliente (aprobar en 1 clic + subir SINPE)"
                          >
                            🔗 Portal
                          </button>
                        )}
                        <a
                          href={`/api/quotes/${qt.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-[#0070C0] hover:bg-sky-50"
                          title={`Ver PDF (${filename})`}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <a
                          href={`/api/quotes/${qt.id}/pdf?download=1`}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                          title={`Descargar ${filename}`}
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => openSendModal(qt, "EMAIL")}
                          className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50"
                          title="Enviar por Correo SMTP con PDF adjunto"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openSendModal(qt, "WHATSAPP")}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                          title="Enviar por WhatsApp (Meta API o Desktop)"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditBuilder(qt, false)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          title="Editar Proforma"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditBuilder(qt, true)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          title="Duplicar Proforma"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteQuote(qt.id)}
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
              {quotes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No hay facturas proforma aún. Crea la primera con el botón &ldquo;Nueva Proforma&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proforma Builder Modal */}
      {builderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 md:p-6">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[94vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0070C0]" />
                <h2 className="text-lg font-bold text-slate-900">
                  {editingQuoteId ? "Editar Factura Proforma" : "Nueva Factura Proforma · Caminante Corporativo"}
                </h2>
              </div>
              <button onClick={() => setBuilderOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuote} className="p-6 space-y-6">
              {/* AI Quote Extractor Bar */}
              <div className="bg-gradient-to-r from-purple-50 to-sky-50 border border-purple-200/70 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-900 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Asistente IA: Pega un mensaje de WhatsApp o Correo y arma las líneas automáticamente
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    placeholder="Ej. Ocupo cotizar 30 camisas polo bordadas y 12 pares de botas Kayman con IVA incluido..."
                    className="flex-1 px-3 py-2 text-xs bg-white border border-purple-200 rounded-xl"
                  />
                  <button
                    type="button"
                    disabled={aiExtracting}
                    onClick={() => runAiExtract()}
                    className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shrink-0"
                  >
                    {aiExtracting ? "Analizando..." : "Armar con IA"}
                  </button>
                </div>
              </div>

              {/* Client & Commercial Meta */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-sm">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Seleccionar Cliente Registrado</label>
                  <select
                    value={form.clientId}
                    onChange={(e) => handleSelectClient(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="">-- Cliente nuevo / llenar manual --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company} {c.contactName ? `(${c.contactName})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Id. del cliente</label>
                  <input
                    value={form.clientCode}
                    onChange={(e) => setForm({ ...form, clientCode: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600">Para (Empresa / Institución) *</label>
                  <input
                    required
                    value={form.clientCompany}
                    onChange={(e) => setForm({ ...form, clientCompany: e.target.value })}
                    placeholder="Ej. MEP"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Contacto</label>
                  <input
                    value={form.clientContact}
                    onChange={(e) => setForm({ ...form, clientContact: e.target.value })}
                    placeholder="Ej. BRAULIO VILLEGAS"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Dirección</label>
                  <input
                    value={form.clientAddress}
                    onChange={(e) => setForm({ ...form, clientAddress: e.target.value })}
                    placeholder="SAN CARLOS, ALAJUELA"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Teléfono / WhatsApp</label>
                  <input
                    value={form.clientPhone}
                    onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                    placeholder="8679-1284"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Correo electrónico</label>
                  <input
                    value={form.clientEmail}
                    onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                    placeholder="cliente@empresa.cr"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Exact Caminante Excel Commercial Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#0070C0]/5 border border-[#0070C0]/20 p-4 rounded-2xl text-sm">
                <div>
                  <label className="text-xs font-bold text-[#0070C0]">Vendedor</label>
                  <input
                    value={form.seller}
                    onChange={(e) => setForm({ ...form, seller: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#0070C0]">Trabajo</label>
                  <input
                    value={form.jobTitle}
                    onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                    placeholder="UNIFORMES ESCOLARES / BOTAS / BORDADOS"
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#0070C0]">Condiciones de pago</label>
                  <select
                    value={form.paymentTerms}
                    onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="CONTADO">CONTADO</option>
                    <option value="CREDITO">CRÉDITO</option>
                    <option value="50% ADELANTO / 50% ENTREGA">50% ADELANTO / 50% ENTREGA</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#0070C0]">Fecha de vencimiento</label>
                  <input
                    value={form.validity}
                    onChange={(e) => setForm({ ...form, validity: e.target.value })}
                    placeholder="30 días"
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Tax Mode & Quick Add Product */}
              <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Agregar producto rápido del catálogo
                  </label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddProductLine(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="">+ Elegir producto (uniformes, bordados, promocionales, deportivos, calzado)...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.category}] {p.name} — {formatMoney(p.price)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    Modo de Impuesto (Hojas Excel)
                  </label>
                  <select
                    value={form.taxMode}
                    onChange={(e) => setForm({ ...form, taxMode: e.target.value })}
                    className="px-3 py-2 text-sm font-semibold border border-[#0070C0]/40 rounded-xl bg-sky-50 text-[#0070C0]"
                  >
                    {TAX_MODES.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Moneda</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="CRC">₡ Colones (CRC)</option>
                    <option value="USD">$ Dólares (USD)</option>
                  </select>
                </div>
              </div>

              {/* Line items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Líneas de la Factura Proforma</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setLines([...lines, { quantity: 1, title: "", description: "", unitPrice: 0 }])
                    }
                    className="text-xs font-semibold text-[#0070C0] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar línea manual
                  </button>
                </div>

                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70"
                  >
                    <div className="col-span-3 sm:col-span-2">
                      <label className="text-[11px] font-semibold text-slate-500">Cant.</label>
                      <input
                        type="number"
                        min={1}
                        step="any"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                        className="w-full mt-0.5 px-2.5 py-1.5 text-sm bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="col-span-9 sm:col-span-5">
                      <label className="text-[11px] font-semibold text-slate-500">Artículo / Título *</label>
                      <input
                        required
                        value={line.title}
                        onChange={(e) => updateLine(idx, { title: e.target.value })}
                        placeholder="Ej. COLCHONETA ARTES MARCIALES"
                        className="w-full mt-0.5 px-2.5 py-1.5 text-sm font-semibold bg-white border border-slate-200 rounded-lg"
                      />
                      <textarea
                        rows={2}
                        value={line.description}
                        onChange={(e) => updateLine(idx, { description: e.target.value })}
                        placeholder="Especificaciones multilínea (ej. TATAMI 1X1, tallas, bordado...)"
                        className="w-full mt-1.5 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-2">
                      <label className="text-[11px] font-semibold text-slate-500">Precio Unit.</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })}
                        className="w-full mt-0.5 px-2.5 py-1.5 text-sm bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-2 text-right">
                      <label className="text-[11px] font-semibold text-slate-500 block">Total línea</label>
                      <div className="mt-2 font-bold text-sm text-slate-900">
                        {formatMoney((line.quantity || 0) * (line.unitPrice || 0), form.currency)}
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start pt-2 border-t border-slate-200">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Notas adicionales en el PDF</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Ej. Entrega en 5 días hábiles posterior a aprobación de arte de bordado."
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-semibold">{formatMoney(totals.subtotal, form.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">Descuento</span>
                    <input
                      type="number"
                      min={0}
                      value={form.discountAmount}
                      onChange={(e) => setForm({ ...form, discountAmount: Number(e.target.value) })}
                      className="w-32 text-right px-2 py-1 text-sm bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  {form.taxMode === "DESGLOSADO" && (
                    <div className="flex justify-between text-slate-700">
                      <span>Impuesto sobre las ventas (13%)</span>
                      <span className="font-semibold">{formatMoney(totals.taxAmount, form.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-lg font-bold text-[#0070C0]">
                    <span>Total Proforma</span>
                    <span>{formatMoney(totals.total, form.currency)}</span>
                  </div>
                  {form.taxMode === "IVA_INCLUIDO" && (
                    <div className="text-[11px] text-slate-500 text-right">
                      * Precio con IVA 13% incluido (IVA interno aprox: {formatMoney(totals.includedTaxInfo, form.currency)})
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBuilderOpen(false)}
                  className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 text-sm font-bold bg-[#0070C0] hover:bg-[#005a9e] text-white rounded-xl shadow-sm"
                >
                  {saving ? "Generando..." : editingQuoteId ? "Guardar Cambios" : "Guardar y Generar Proforma"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Modal (Email SMTP + PDF / WhatsApp Meta Cloud API + Desktop Link) */}
      {sendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Enviar Proforma #{sendTarget.number} ({sendTarget.clientCompany})
              </h2>
              <button onClick={() => setSendTarget(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2">
              {(["EMAIL", "WHATSAPP", "BOTH"] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setSendChannel(ch)}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                    sendChannel === ch
                      ? "bg-[#0070C0] text-white border-[#0070C0]"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  {ch === "EMAIL" ? "Correo + PDF" : ch === "WHATSAPP" ? "WhatsApp" : "Ambos"}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl space-y-1">
              <div><strong>Correo destino:</strong> {sendTarget.clientEmail || "(Sin correo)"}</div>
              <div><strong>WhatsApp:</strong> {sendTarget.clientPhone || "(Sin teléfono)"}</div>
              <div><strong>Adjunto PDF:</strong> {sendTarget.number}-{sanitizeFilename(sendTarget.clientCompany)}.pdf</div>
            </div>

            {(sendChannel === "EMAIL" || sendChannel === "BOTH") && emailAccounts.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-600">Enviar desde cuenta corporativa</label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-semibold"
                >
                  {emailAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.label} — {acc.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-600">Mensaje</label>
              <textarea
                rows={5}
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
              />
            </div>

            {sendFeedback && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{sendFeedback.text}</span>
                </div>
                {sendFeedback.waLink && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={sendFeedback.waAppLink}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold"
                    >
                      Abrir WhatsApp App Desktop
                    </a>
                    <a
                      href={sendFeedback.waLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-semibold"
                    >
                      Abrir WhatsApp Web
                    </a>
                    <a
                      href={`/api/quotes/${sendTarget.id}/pdf?download=1`}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold"
                    >
                      Descargar PDF
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSendTarget(null)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-xl"
              >
                Cerrar
              </button>
              <button
                onClick={executeSend}
                disabled={sending}
                className="px-5 py-2 text-sm font-bold bg-[#0070C0] hover:bg-[#005a9e] text-white rounded-xl"
              >
                {sending ? "Enviando..." : "Enviar Ahora"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CotizacionesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Cargando cotizador...</div>}>
      <CotizacionesInner />
    </Suspense>
  );
}
