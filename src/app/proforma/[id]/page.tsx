"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Upload,
  Copy,
  Sparkles,
  Phone,
  Building2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { formatDateCR, formatMoney } from "@/lib/format";

interface PublicQuoteData {
  quote: {
    id: string;
    number: number;
    clientCompany: string;
    clientContact: string;
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
    paidAmount?: number;
    paymentLinkUrl?: string;
    feNumber?: string;
    feStatus?: string;
    status: string;
    notes: string;
    issueDate: string;
    seller: string;
    items: Array<{
      id: string;
      quantity: number;
      title: string;
      description: string;
      unitPrice: number;
      lineTotal: number;
    }>;
  };
  company: {
    brandName: string;
    companyName: string;
    legalId: string;
    logoPath: string;
    primaryColor: string;
    accentColor: string;
    phone: string;
    whatsapp: string;
    sinpePhone: string;
    email: string;
    footerMotto: string;
    bankAccounts: Array<{ bank: string; iban: string; currency: string; holder?: string }>;
  };
}

interface SinpeVerification {
  amount?: string;
  reference?: string;
  bank?: string;
  senderName?: string;
  date?: string;
  matchesTotal?: boolean;
  summary?: string;
}

export default function PublicProformaPortalPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id || "";
  const sig = searchParams?.get("sig") || "";

  const [data, setData] = useState<PublicQuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  const [banner, setBanner] = useState("");
  const [verification, setVerification] = useState<SinpeVerification | null>(null);

  useEffect(() => {
    if (!id || !sig) {
      setError("Enlace de proforma incompleto o inválido.");
      setLoading(false);
      return;
    }
    fetch(`/api/public/quotes/${encodeURIComponent(id)}?sig=${encodeURIComponent(sig)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "No se pudo abrir la proforma.");
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error cargando proforma."))
      .finally(() => setLoading(false));
  }, [id, sig]);

  const handleApprove = async () => {
    setApproving(true);
    setBanner("");
    try {
      const res = await fetch(`/api/public/quotes/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sig, action: "approve", note: customerNote }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "No se pudo aprobar.");
      setBanner(out.message || "✅ Proforma aprobada con éxito.");
      setData((prev) => (prev ? { ...prev, quote: { ...prev.quote, status: "APROBADA" } } : prev));
    } catch (e) {
      setBanner(`❌ ${e instanceof Error ? e.message : "Error aprobando proforma."}`);
    } finally {
      setApproving(false);
    }
  };

  const handleSinpeUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setBanner("");
    try {
      const fd = new FormData();
      fd.append("sig", sig);
      fd.append("action", "upload_sinpe");
      fd.append("note", customerNote);
      fd.append("file", file);

      const res = await fetch(`/api/public/quotes/${encodeURIComponent(id)}`, {
        method: "POST",
        body: fd,
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "No se pudo subir el comprobante.");
      setBanner(out.message || "✅ Comprobante recibido.");
      if (out.verification) setVerification(out.verification);
      setData((prev) => (prev ? { ...prev, quote: { ...prev.quote, status: "APROBADA" } } : prev));
    } catch (e) {
      setBanner(`❌ ${e instanceof Error ? e.message : "Error enviando comprobante."}`);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="flex items-center gap-2 text-slate-600 text-sm font-semibold">
          <Loader2 className="w-5 h-5 animate-spin text-[#0070C0]" />
          Cargando tu Factura Proforma...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-3 shadow-sm">
          <div className="text-3xl">🔒</div>
          <h1 className="text-lg font-bold text-slate-900">Enlace no disponible</h1>
          <p className="text-sm text-slate-500">{error || "Solicita un nuevo enlace a tu asesor."}</p>
        </div>
      </div>
    );
  }

  const { quote, company } = data;
  const isApproved = quote.status === "APROBADA";

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Branded Header Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div
            className="p-6 text-white flex flex-wrap items-center justify-between gap-4"
            style={{ background: `linear-gradient(135deg, ${company.primaryColor} 0%, ${company.accentColor} 100%)` }}
          >
            <div className="flex items-center gap-3.5">
              {company.logoPath ? (
                <img
                  src={company.logoPath}
                  alt={company.brandName}
                  className="h-12 w-auto max-w-[140px] object-contain bg-white rounded-xl p-1.5"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-black tracking-tight">{company.brandName}</h1>
                <p className="text-xs text-white/85">
                  {company.companyName} {company.legalId ? `· Céd. ${company.legalId}` : ""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-white/80 font-bold">Factura Proforma</div>
              <div className="text-2xl font-black">N.º {quote.number}</div>
              <span
                className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                  isApproved ? "bg-emerald-400 text-emerald-950" : "bg-amber-300 text-amber-950"
                }`}
              >
                {isApproved ? "✅ APROBADA" : `● ${quote.status}`}
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {banner && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold">
                {banner}
              </div>
            )}

            {/* Client & Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400">Cliente</div>
                <div className="font-bold text-slate-900 text-sm">{quote.clientCompany}</div>
                {quote.clientContact && <div className="text-slate-600">Atención: {quote.clientContact}</div>}
                {quote.jobTitle && <div className="text-slate-500 mt-0.5">Referencia: {quote.jobTitle}</div>}
              </div>
              <div className="sm:text-right">
                <div className="text-[10px] font-bold uppercase text-slate-400">Detalles</div>
                <div className="text-slate-700">Fecha: <strong>{formatDateCR(quote.issueDate)}</strong></div>
                <div className="text-slate-700">Condición: <strong>{quote.paymentTerms}</strong> · Validez: {quote.validity}</div>
                <div className="text-slate-500">Asesor: {quote.seller}</div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Cant.</th>
                    <th className="py-2.5 px-3">Descripción</th>
                    <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quote.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-3 px-3 font-bold text-slate-700">{it.quantity}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{it.title}</div>
                        {it.description && <div className="text-xs text-slate-500">{it.description}</div>}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {formatMoney(it.unitPrice, quote.currency)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatMoney(it.lineTotal, quote.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
              <div className="text-xs text-slate-500 max-w-md">
                {quote.notes && <p className="mb-1 text-slate-700"><strong>Notas:</strong> {quote.notes}</p>}
                <p>
                  Régimen de impuesto:{" "}
                  <strong>
                    {quote.taxMode === "IVA_INCLUIDO"
                      ? "IVA 13% Incluido"
                      : quote.taxMode === "DESGLOSADO"
                      ? "IVA 13% Desglosado"
                      : "Exonerado (0%)"}
                  </strong>
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 min-w-[230px] text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatMoney(quote.subtotal, quote.currency)}</span>
                </div>
                {quote.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Descuento</span>
                    <span>-{formatMoney(quote.discountAmount, quote.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>IVA ({Math.round(quote.taxRate * 100)}%)</span>
                  <span>{formatMoney(quote.taxAmount, quote.currency)}</span>
                </div>
                <div className="flex justify-between text-lg font-black text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>Total</span>
                  <span>{formatMoney(quote.total, quote.currency)}</span>
                </div>
                {(quote.paidAmount || 0) > 0 && (
                  <>
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Abonado</span>
                      <span>-{formatMoney(quote.paidAmount || 0, quote.currency)}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 font-black pt-1 border-t border-slate-200">
                      <span>Saldo pendiente</span>
                      <span>{formatMoney(Math.max(0, quote.total - (quote.paidAmount || 0)), quote.currency)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payment Details (SINPE + Bank Accounts) */}
            {(company.sinpePhone || company.bankAccounts.length > 0) && (
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2 text-xs">
                <div className="font-extrabold text-[#22115d] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#0070C0]" />
                  Datos Oficiales para Pago (SINPE Móvil / Transferencia)
                </div>
                {company.sinpePhone && (
                  <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-indigo-100">
                    <span>
                      📲 <strong>SINPE Móvil:</strong> {company.sinpePhone} ({company.companyName})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(company.sinpePhone);
                        setBanner(`📋 Número SINPE ${company.sinpePhone} copiado.`);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-[#22115d] font-bold hover:bg-indigo-100"
                    >
                      <Copy className="w-3 h-3" /> Copiar
                    </button>
                  </div>
                )}
                {company.bankAccounts.map((acc, i) => (
                  <div key={i} className="bg-white p-2.5 rounded-xl border border-indigo-100 flex flex-wrap justify-between gap-2">
                    <span>
                      🏦 <strong>{acc.bank} ({acc.currency}):</strong> <code className="font-mono">{acc.iban}</code>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(acc.iban);
                        setBanner(`📋 Cuenta IBAN copiada.`);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold"
                    >
                      <Copy className="w-3 h-3" /> Copiar IBAN
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action Box: Approve + Upload SINPE Receipt + Download PDF */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white space-y-3">
              <div className="text-sm font-bold">Acciones rápidas para tu pedido</div>
              <input
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Nota opcional para tu asesor (ej. tallas, dirección o horario de entrega)..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder:text-white/60 focus:outline-none focus:border-sky-400"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  disabled={approving}
                  onClick={handleApprove}
                  className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-extrabold text-xs transition"
                >
                  {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isApproved ? "Aprobada ✓" : "Aprobar Proforma"}
                </button>

                <label className="cursor-pointer inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs transition">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Validando SINPE..." : "Subir Comprobante SINPE"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => handleSinpeUpload(e.target.files?.[0] || null)}
                  />
                </label>

                <a
                  href={`/api/quotes/${encodeURIComponent(id)}/pdf?sig=${encodeURIComponent(sig)}&download=1`}
                  className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs transition"
                >
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </a>
              </div>
              {quote.paymentLinkUrl && (
                <a
                  href={quote.paymentLinkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs transition"
                >
                  💳 Pagar con Tarjeta en Línea
                </a>
              )}

              {verification && (
                <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-400/50 text-xs space-y-1">
                  <div className="font-extrabold text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Comprobante analizado automáticamente por IA
                  </div>
                  <p className="text-emerald-100">{verification.summary}</p>
                  <div className="flex flex-wrap gap-3 text-[11px] text-emerald-200/90 pt-1">
                    {verification.amount && <span>💰 Monto: <strong>{verification.amount}</strong></span>}
                    {verification.reference && <span>🔖 Ref: <strong>{verification.reference}</strong></span>}
                    {verification.bank && <span>🏦 Banco: <strong>{verification.bank}</strong></span>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
              <span>{company.footerMotto}</span>
              {(company.whatsapp || company.phone) && (
                <span className="inline-flex items-center gap-1 text-slate-600 font-semibold">
                  <Phone className="w-3 h-3" /> {company.whatsapp || company.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
