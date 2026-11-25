"use client";

import React, { useState } from "react";
import {
  Printer,
  BookOpenCheck,
  CheckCircle2,
  Sparkles,
  ArrowUp,
  Plug,
  ExternalLink,
  AlertTriangle,
  Wrench,
} from "lucide-react";
import { DAILY_ROUTINE, MANUAL_SECTIONS } from "@/lib/manual-content";
import {
  CONNECTION_GUIDES,
  QUICK_PORTAL_LINKS,
  TROUBLESHOOTING_ROWS,
} from "@/lib/connections-manual-content";

export default function ManualPage() {
  const [activeDoc, setActiveDoc] = useState<"uso" | "conexiones">("uso");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Screen-only toolbar + switcher */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-[#22115d] shrink-0">
              {activeDoc === "uso" ? (
                <BookOpenCheck className="w-6 h-6" />
              ) : (
                <Plug className="w-6 h-6" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {activeDoc === "uso"
                  ? "Manual de Uso · impulsa CRM"
                  : "Manual Interno de Conexiones · Meta, WhatsApp, IG, Messenger, Correos e IA"}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeDoc === "uso"
                  ? "Guía completa ventana por ventana y botón por botón para el equipo comercial."
                  : "Guía técnica paso a paso con todos los enlaces oficiales para conectar cualquier empresa."}
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

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setActiveDoc("uso")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeDoc === "uso"
                ? "bg-[#22115d] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <BookOpenCheck className="w-4 h-4" />
            1. Manual de Uso (Ventanas y Botones)
          </button>
          <button
            type="button"
            onClick={() => setActiveDoc("conexiones")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeDoc === "conexiones"
                ? "bg-[#0070C0] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Plug className="w-4 h-4" />
            2. Manual Interno de Conexiones (Meta, WhatsApp, IG, Messenger, Correos e IA)
          </button>
        </div>
      </div>

      {/* ================= TAB 1: USER MANUAL ================= */}
      {activeDoc === "uso" && (
        <>
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

          <div className="bg-white rounded-2xl border border-slate-200 print:border-0 print:rounded-none shadow-xs print:shadow-none p-6 md:p-10 print:p-0 space-y-8">
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
                    impulsa CRM · Plataforma Multiempresa
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Guía completa de operación: ventas, proformas PDF, bandeja omnicanal, catálogo y Agente IA
                  </p>
                </div>
              </div>
              <div className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 shrink-0">
                <div>
                  <span className="font-bold text-slate-700">Acceso Web 24/7:</span>{" "}
                  <span className="text-[#0070C0] font-semibold">impulsa-crm2.vercel.app</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700">Registro nueva empresa:</span>{" "}
                  impulsa-crm2.vercel.app/login?mode=register
                </div>
                <div>
                  <span className="font-bold text-slate-700">Webhook Meta 24/7:</span>{" "}
                  /api/webhooks/meta
                </div>
              </div>
            </div>

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
                  08. Cotizaciones PDF (₡/$ · IVA 13% Incluido / Desglosado / Exonerado) · 09. Catálogo e Inventario
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-100">
                <div className="font-bold text-purple-900 mb-1">IA Y SISTEMA</div>
                <p className="text-slate-600 leading-relaxed">
                  10. Conocimiento y Docs · 11. Agente IA y Reglas · 12. Conexiones, Empresa, Respaldos y Limpieza
                </p>
              </div>
            </div>

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

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>Manual de Uso Oficial · impulsa CRM</span>
              <span>https://impulsa-crm2.vercel.app/manual</span>
            </div>
          </div>
        </>
      )}

      {/* ================= TAB 2: INTERNAL CONNECTIONS MANUAL ================= */}
      {activeDoc === "conexiones" && (
        <>
          <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Saltar a conexión específica
            </div>
            <div className="flex flex-wrap gap-1.5">
              <a
                href="#directorio-links"
                className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-[#22115d]"
              >
                🔗 Directorio de Enlaces
              </a>
              {CONNECTION_GUIDES.map((g) => (
                <a
                  key={g.id}
                  href={`#conn-${g.id}`}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-sky-50 border border-slate-200 text-xs font-medium text-slate-700 hover:text-[#0070C0]"
                >
                  <span className="font-bold text-[#0070C0] mr-1">{g.number}.</span>
                  {g.title.split("(")[0].trim()}
                </a>
              ))}
              <a
                href="#troubleshooting"
                className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900"
              >
                🛠️ Solución de Errores
              </a>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 print:border-0 print:rounded-none shadow-xs print:shadow-none p-6 md:p-10 print:p-0 space-y-8">
            {/* Printable Header */}
            <div className="border-b-2 border-[#0070C0] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img
                  src="/brand/impulsa-symbol.svg"
                  alt="impulsa CRM"
                  className="w-14 h-14 object-contain shrink-0"
                />
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#0070C0]">
                    Manual Técnico Interno · Integraciones
                  </div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-[#22115d] leading-tight">
                    Guía de Conexiones · impulsa CRM
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Paso a paso y enlaces oficiales para conectar WhatsApp Cloud API, Messenger, Instagram, Lead Ads, Correos SMTP/IMAP y Gemini IA
                  </p>
                </div>
              </div>
              <div className="text-xs bg-sky-50 border border-sky-200 rounded-xl p-3 space-y-1 shrink-0">
                <div className="font-bold text-[#0070C0]">URL del Webhook Universal (24/7):</div>
                <div className="font-mono text-[11px] font-bold text-slate-900 break-all">
                  https://impulsa-crm2.vercel.app/api/webhooks/meta
                </div>
                <div className="text-[11px] text-slate-600">
                  Enruta automáticamente cada empresa por Phone Number ID / Page ID.
                </div>
              </div>
            </div>

            {/* Direct Links Directory */}
            <section id="directorio-links" className="print-break-inside-avoid space-y-3">
              <h2 className="text-base font-extrabold text-[#22115d]">
                Directorio Oficial de Enlaces Directos
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600">
                      <th className="py-2 px-3 border border-slate-200 w-[30%]">Portal / Herramienta</th>
                      <th className="py-2 px-3 border border-slate-200 w-[38%]">Enlace directo</th>
                      <th className="py-2 px-3 border border-slate-200">Para qué se usa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {QUICK_PORTAL_LINKS.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="py-2 px-3 border border-slate-200 font-bold text-slate-900">
                          {item.label}
                        </td>
                        <td className="py-2 px-3 border border-slate-200">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#0070C0] hover:underline font-mono text-[11px] inline-flex items-center gap-1 break-all"
                          >
                            {item.url}
                            <ExternalLink className="w-3 h-3 shrink-0 no-print" />
                          </a>
                        </td>
                        <td className="py-2 px-3 border border-slate-200 text-slate-600">
                          {item.note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Step-by-step guides for all 5 integrations */}
            <div className="space-y-8">
              {CONNECTION_GUIDES.map((guide) => (
                <section
                  key={guide.id}
                  id={`conn-${guide.id}`}
                  className="border border-slate-200 rounded-2xl overflow-hidden"
                >
                  <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#0070C0] text-white text-xs font-extrabold shrink-0">
                        {guide.number}
                      </span>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#0070C0]">
                          {guide.badge}
                        </div>
                        <h2 className="text-base font-extrabold text-slate-900">{guide.title}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{guide.subtitle}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Prerequisites */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 print-break-inside-avoid">
                      <div className="font-bold text-slate-800 uppercase tracking-wide text-[10px]">
                        Requisitos previos
                      </div>
                      <ul className="list-disc pl-5 space-y-1 text-slate-700">
                        {guide.prerequisites.map((req, idx) => (
                          <li key={idx}>{req}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Numbered Steps */}
                    <div className="space-y-3">
                      {guide.steps.map((st, idx) => (
                        <div
                          key={idx}
                          className="print-break-inside-avoid p-4 rounded-xl border border-slate-200 bg-white space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-bold text-sm text-[#22115d]">
                              Paso {idx + 1}. {st.title}
                            </div>
                            {st.link && (
                              <a
                                href={st.link.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-[11px] font-bold text-[#0070C0] hover:bg-sky-100"
                              >
                                {st.link.label}
                                <ExternalLink className="w-3 h-3 no-print" />
                              </a>
                            )}
                          </div>
                          {st.link && (
                            <div className="text-[11px] font-mono text-slate-400 break-all">
                              {st.link.url}
                            </div>
                          )}
                          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700 leading-relaxed">
                            {st.details.map((d, j) => (
                              <li key={j}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    {/* Fields summary table */}
                    <div className="print-break-inside-avoid space-y-2">
                      <div className="text-xs font-bold text-slate-800">
                        Resumen de campos a llenar en impulsa CRM → Conexiones y empresa
                      </div>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-left text-[11px] text-slate-600">
                            <th className="py-2 px-3 border border-slate-200 w-[35%]">Campo en el CRM</th>
                            <th className="py-2 px-3 border border-slate-200">Dónde obtener el valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {guide.crmFields.map((f, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 border border-slate-200 font-bold text-[#22115d]">
                                {f.field}
                              </td>
                              <td className="py-2 px-3 border border-slate-200 text-slate-700">
                                {f.whereToFind}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {guide.warning && (
                      <div className="print-break-inside-avoid flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Nota importante:</strong> {guide.warning}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </div>

            {/* Troubleshooting */}
            <section
              id="troubleshooting"
              className="print-break-inside-avoid border-2 border-amber-200 rounded-2xl p-5 bg-amber-50/40 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-700" />
                <h2 className="text-base font-extrabold text-amber-950">
                  Solución Rápida de Errores Frecuentes
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse bg-white">
                  <thead>
                    <tr className="bg-amber-100/80 text-left text-[11px] uppercase text-amber-950">
                      <th className="py-2 px-3 border border-amber-200 w-[30%]">Mensaje / Problema</th>
                      <th className="py-2 px-3 border border-amber-200 w-[28%]">Causa</th>
                      <th className="py-2 px-3 border border-amber-200">Solución inmediata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TROUBLESHOOTING_ROWS.map((r, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-amber-50/30"}>
                        <td className="py-2 px-3 border border-amber-200 font-bold text-rose-800 align-top">
                          {r.error}
                        </td>
                        <td className="py-2 px-3 border border-amber-200 text-slate-600 align-top">
                          {r.cause}
                        </td>
                        <td className="py-2 px-3 border border-amber-200 text-slate-800 align-top">
                          {r.fix}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>Manual Interno de Conexiones · impulsa CRM</span>
              <span>https://impulsa-crm2.vercel.app/manual</span>
            </div>
          </div>
        </>
      )}

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
