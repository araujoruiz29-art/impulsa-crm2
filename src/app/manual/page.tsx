"use client";

import React from "react";
import { Printer, BookOpenCheck, CheckCircle2, Sparkles, ArrowUp } from "lucide-react";
import { DAILY_ROUTINE, MANUAL_SECTIONS } from "@/lib/manual-content";

export default function ManualPage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Screen-only toolbar */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-[#22115d] shrink-0">
            <BookOpenCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Manual de Uso · impulsa CRM (Caminante Corporativo)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Guía completa ventana por ventana y botón por botón. Lista para imprimir en papel o guardar como PDF.
            </p>
          </div>
        </div>
        <button
          onClick={handlePrint}
          className="btn-brand inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl shadow-sm shrink-0 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Imprimir / Guardar PDF
        </button>
      </div>

      {/* Quick navigation index (screen only) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
          Índice rápido de ventanas ({MANUAL_SECTIONS.length} secciones)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MANUAL_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-xs font-medium text-slate-700 hover:text-[#22115d] transition"
            >
              <span className="font-bold text-[#0070C0] mr-1">{s.number}.</span>
              {s.title.split("(")[0].trim()}
            </a>
          ))}
          <a
            href="#rutina-diaria"
            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold text-emerald-800 transition"
          >
            ★ Rutina Diaria del Vendedor
          </a>
        </div>
      </div>

      {/* PRINTABLE DOCUMENT START */}
      <div className="bg-white rounded-2xl border border-slate-200 print:border-0 print:rounded-none shadow-xs print:shadow-none p-6 md:p-10 print:p-0 space-y-8">
        {/* Printable Cover Header */}
        <div className="border-b-2 border-[#22115d] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/brand/impulsa-symbol.svg"
              alt="impulsa CRM"
              className="w-14 h-14 object-contain shrink-0"
            />
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#0070C0]">
                Manual Operativo de Usuario
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#22115d] leading-tight">
                impulsa CRM · Caminante Corporativo
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Esquivel y Alfaro El Caminante S.A · Cédula Jurídica 3-101-260251 · San Carlos, Alajuela, Costa Rica
              </p>
            </div>
          </div>
          <div className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 shrink-0">
            <div>
              <span className="font-bold text-slate-700">Acceso Web 24/7:</span>{" "}
              <span className="text-[#0070C0] font-semibold">impulsa-crm2.vercel.app</span>
            </div>
            <div>
              <span className="font-bold text-slate-700">WhatsApp Oficial:</span> +506 8449-1975
            </div>
            <div>
              <span className="font-bold text-slate-700">Correos:</span> ventas@ y uniformes@elcaminantecr.com
            </div>
            <div>
              <span className="font-bold text-slate-700">SINPE Móvil:</span> 8691-1975
            </div>
          </div>
        </div>

        {/* Printable Table of Contents Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs print-break-inside-avoid">
          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100">
            <div className="font-bold text-[#22115d] mb-1">TU ESPACIO (Operación diaria)</div>
            <p className="text-slate-600 leading-relaxed">
              02. Resumen · 03. Conversaciones · 04. Avisos al Vendedor · 05. Ventas Kanban · 06. Contactos · 07. Agenda y Reportes
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-100">
            <div className="font-bold text-[#0070C0] mb-1">CATÁLOGO Y PROFORMAS</div>
            <p className="text-slate-600 leading-relaxed">
              08. Cotizaciones PDF (₡ IVA 13% Incluido / Desglosado / Exonerado) · 09. Catálogo e Inventario + Stock Web por Foto
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-100">
            <div className="font-bold text-purple-900 mb-1">IA Y SISTEMA</div>
            <p className="text-slate-600 leading-relaxed">
              10. Conocimiento y Docs (Horarios) · 11. Agente IA y Reglas · 12. Conexiones, Empresa, Respaldos y Limpieza
            </p>
          </div>
        </div>

        {/* All 12 Window Sections */}
        <div className="space-y-7">
          {MANUAL_SECTIONS.map((sec) => (
            <section
              key={sec.id}
              id={sec.id}
              className="print-break-inside-avoid border border-slate-200 rounded-2xl overflow-hidden"
            >
              <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#22115d] text-white text-xs font-extrabold shrink-0">
                    {sec.number}
                  </span>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {sec.group}
                    </div>
                    <h2 className="text-base font-extrabold text-slate-900 leading-snug">
                      {sec.title}
                    </h2>
                  </div>
                </div>
                <span className="text-[11px] font-mono bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600">
                  {sec.route}
                </span>
              </div>

              <div className="p-5 space-y-3.5">
                <p className="text-xs md:text-sm text-slate-700 leading-relaxed">{sec.summary}</p>

                {sec.tip && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50/80 border border-sky-200 text-xs text-sky-950">
                    <Sparkles className="w-4 h-4 text-[#0070C0] shrink-0 mt-0.5" />
                    <div>
                      <strong>Consejo práctico:</strong> {sec.tip}
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 text-left text-[11px] uppercase tracking-wide text-slate-600">
                        <th className="py-2 px-3 border border-slate-200 w-[28%]">Botón / Control</th>
                        <th className="py-2 px-3 border border-slate-200 w-[22%]">Ubicación</th>
                        <th className="py-2 px-3 border border-slate-200">Para qué funciona</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sec.buttons.map((b, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                          <td className="py-2 px-3 border border-slate-200 font-bold text-[#22115d] align-top">
                            {b.control}
                          </td>
                          <td className="py-2 px-3 border border-slate-200 text-slate-500 align-top">
                            {b.location}
                          </td>
                          <td className="py-2 px-3 border border-slate-200 text-slate-700 leading-relaxed align-top">
                            {b.purpose}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* Daily Routine Quick-Reference Sheet */}
        <section
          id="rutina-diaria"
          className="print-break-inside-avoid rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-5 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <h2 className="text-base font-extrabold text-emerald-950">
                13. Rutina Diaria Recomendada para el Equipo de Ventas
              </h2>
              <p className="text-xs text-emerald-900/80">
                Resumen rápido de 5 pasos para trabajar de forma ordenada todos los días.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DAILY_ROUTINE.map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-emerald-200/80 p-3.5 space-y-1"
              >
                <div className="text-xs font-extrabold text-emerald-900">{item.step}</div>
                <p className="text-xs text-slate-600 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>Manual de Uso Oficial · impulsa CRM · Caminante Corporativo</span>
          <span>Impreso desde impulsa-crm2.vercel.app/manual</span>
        </div>
      </div>

      {/* Back to top (screen only) */}
      <div className="no-print flex justify-end">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
        >
          <ArrowUp className="w-3.5 h-3.5" /> Subir al inicio
        </button>
      </div>
    </div>
  );
}
