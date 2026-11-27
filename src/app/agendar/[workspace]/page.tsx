"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Calendar, Clock, CheckCircle2, Loader2, Building2 } from "lucide-react";

interface BookingCompany {
  id: string;
  brandName: string;
  companyName: string;
  primaryColor: string;
  accentColor: string;
  logoPath: string;
  address: string;
}

interface SlotItem {
  iso: string;
  label: string;
  available: boolean;
}

export default function PublicBookingPage() {
  const params = useParams<{ workspace: string }>();
  const workspace = params?.workspace || "default";

  const [company, setCompany] = useState<BookingCompany | null>(null);
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [selectedIso, setSelectedIso] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", serviceName: "Asesoría / Demostración", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [confirmedMsg, setConfirmedMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/public/booking/${encodeURIComponent(workspace)}?date=${encodeURIComponent(date)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Agenda no disponible.");
        setCompany(d.company);
        setSlots(d.slots || []);
        setSelectedIso("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error cargando agenda."))
      .finally(() => setLoading(false));
  }, [workspace, date]);

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIso) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/booking/${encodeURIComponent(workspace)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, startsAt: selectedIso }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo agendar.");
      setConfirmedMsg(d.message || "✅ Cita confirmada.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error agendando cita.");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md">
          <div className="text-3xl mb-2">📅</div>
          <h1 className="text-lg font-bold text-slate-900">Agenda no disponible</h1>
          <p className="text-sm text-slate-500 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          className="p-6 text-white flex items-center gap-4"
          style={{
            background: `linear-gradient(135deg, ${company?.primaryColor || "#1e1046"} 0%, ${
              company?.accentColor || "#0070C0"
            } 100%)`,
          }}
        >
          {company?.logoPath ? (
            <img
              src={company.logoPath}
              alt={company.brandName}
              className="h-12 w-auto max-w-[130px] object-contain bg-white rounded-xl p-1.5"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
          )}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/80 font-bold">Agenda en Línea</div>
            <h1 className="text-xl font-black">{company?.brandName || "Reservar Cita"}</h1>
            {company?.address && <p className="text-xs text-white/80">{company.address}</p>}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {confirmedMsg ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div className="text-base font-extrabold text-emerald-950">{confirmedMsg}</div>
              <p className="text-xs text-emerald-800">
                Fecha: <strong>{date}</strong> · Servicio: <strong>{form.serviceName}</strong>
              </p>
            </div>
          ) : (
            <form onSubmit={submitBooking} className="space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-4 h-4 text-[#0070C0]" /> 1. Elige la fecha
                  </label>
                  <input
                    type="date"
                    value={date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 mb-1.5 block">Motivo / Servicio</label>
                  <input
                    value={form.serviceName}
                    onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                  <Clock className="w-4 h-4 text-[#0070C0]" /> 2. Selecciona una hora disponible (Hora CR)
                </label>
                {loading ? (
                  <div className="py-6 flex justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-[#0070C0]" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((s) => (
                      <button
                        key={s.iso}
                        type="button"
                        disabled={!s.available}
                        onClick={() => setSelectedIso(s.iso)}
                        className={`py-2.5 rounded-xl font-bold text-xs border transition ${
                          selectedIso === s.iso
                            ? "bg-[#22115d] text-white border-[#22115d]"
                            : s.available
                            ? "bg-white hover:bg-indigo-50 border-slate-200 text-slate-800"
                            : "bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed line-through"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Tu nombre completo *"
                  className="px-3.5 py-2.5 border border-slate-200 rounded-xl"
                />
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Tu WhatsApp (para recordatorio) *"
                  className="px-3.5 py-2.5 border border-slate-200 rounded-xl"
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Correo electrónico (opcional)"
                  className="px-3.5 py-2.5 border border-slate-200 rounded-xl sm:col-span-2"
                />
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="¿En qué te podemos ayudar en la cita? (opcional)"
                  className="px-3.5 py-2.5 border border-slate-200 rounded-xl sm:col-span-2"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedIso || submitting}
                className="w-full py-3 rounded-xl bg-[#22115d] hover:bg-indigo-900 disabled:opacity-45 text-white font-extrabold text-sm"
              >
                {submitting ? "Confirmando cita..." : "✅ Confirmar Cita"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
