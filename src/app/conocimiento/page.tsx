"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  FileText,
  ClipboardList,
  Sparkles,
  Store,
  CreditCard,
  Truck,
  RefreshCcw,
  ShieldCheck,
  Tag,
  Pencil,
} from "lucide-react";
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

interface TrainingForm {
  storesAddresses: string;
  storesHours: string;
  holidays: string;
  branchPhones: string;
  pickupHoldTime: string;
  layawayPolicy: string;
  layawayDeadline: string;
  specialOrders: string;
  paymentMethods: string;
  installments: string;
  creditAgreements: string;
  shippingCarrier: string;
  shippingCost: string;
  shippingEta: string;
  shippingDataNeeded: string;
  exchangePolicy: string;
  refundPolicy: string;
  exchangeShippingCost: string;
  warrantyDuration: string;
  warrantyCovers: string;
  warrantyExcludes: string;
  warrantySteps: string;
  webVsStorePrices: string;
  discountsPolicy: string;
  promotionsPolicy: string;
  electronicInvoiceData: string;
  suppliersProtocol: string;
}

const EMPTY_TRAINING: TrainingForm = {
  storesAddresses: "",
  storesHours: "",
  holidays: "",
  branchPhones: "",
  pickupHoldTime: "",
  layawayPolicy: "",
  layawayDeadline: "",
  specialOrders: "",
  paymentMethods: "",
  installments: "",
  creditAgreements: "",
  shippingCarrier: "",
  shippingCost: "",
  shippingEta: "",
  shippingDataNeeded:
    "Nombre completo, número de cédula, teléfono, provincia, cantón, distrito y dirección exacta de entrega.",
  exchangePolicy: "",
  refundPolicy: "",
  exchangeShippingCost: "",
  warrantyDuration: "",
  warrantyCovers: "Defectos de fabricación y fallas de funcionamiento que no sean por mal uso.",
  warrantyExcludes: "Golpes, caídas, mal uso, desgaste natural o reparaciones por terceros.",
  warrantySteps: "Presentar el producto junto con la factura o comprobante de compra para evaluación.",
  webVsStorePrices: "Sí, los precios en línea son los mismos que en tienda física.",
  discountsPolicy: "",
  promotionsPolicy: "",
  electronicInvoiceData: "Nombre completo o razón social, cédula, dirección, correo electrónico y código de actividad.",
  suppliersProtocol:
    "Solicitar datos de contacto (nombre, empresa, teléfono/correo) e información de los productos para trasladarla al departamento de compras.",
};

const WIZARD_DOC_TITLE = "Cuestionario Oficial de Entrenamiento IA";
const WIZARD_MARKER = "<!--IMPULSA_TRAINING_JSON:";

function buildMarkdownFromTraining(f: TrainingForm): string {
  const lines: string[] = [
    "# BASE DE CONOCIMIENTO OFICIAL DEL NEGOCIO (CUESTIONARIO IA)",
    "> Usa siempre estos datos exactos para responder a clientes. Nunca inventes direcciones, horarios, precios ni condiciones.",
    "",
  ];

  const addSection = (heading: string, entries: Array<[string, string]>) => {
    const filled = entries.filter(([, val]) => val.trim().length > 0);
    if (filled.length === 0) return;
    lines.push(`## ${heading}`);
    for (const [label, val] of filled) {
      lines.push(`- **${label}:** ${val.trim()}`);
    }
    lines.push("");
  };

  addSection("1. TIENDAS, DIRECCIONES, HORARIOS Y RETIROS", [
    ["Direcciones y señas", f.storesAddresses],
    ["Horarios de atención", f.storesHours],
    ["Feriados", f.holidays],
    ["WhatsApp / Teléfonos de sucursales", f.branchPhones],
    ["Tiempo de guarda para retiros en tienda", f.pickupHoldTime],
  ]);

  addSection("2. APARTADOS Y PEDIDOS POR ENCARGO", [
    ["Apartados (prima / porcentaje)", f.layawayPolicy],
    ["Plazo de apartado y vencimiento", f.layawayDeadline],
    ["Pedidos por encargo", f.specialOrders],
  ]);

  addSection("3. FORMAS DE PAGO, PLAZOS Y CRÉDITOS", [
    ["Formas de pago aceptadas", f.paymentMethods],
    ["Tasa Cero / pagos a plazos con tarjeta", f.installments],
    ["Créditos y convenios especiales (asociaciones/cooperativas)", f.creditAgreements],
  ]);

  addSection("4. ENVÍOS Y DATOS DE ENTREGA", [
    ["Medio de envío", f.shippingCarrier],
    ["Costo de envío", f.shippingCost],
    ["Tiempo de entrega", f.shippingEta],
    ["Datos obligatorios a pedir al cliente para envío", f.shippingDataNeeded],
  ]);

  addSection("5. CAMBIOS Y DEVOLUCIONES", [
    ["Plazo y condiciones para cambios", f.exchangePolicy],
    ["Devolución de dinero / nota de crédito", f.refundPolicy],
    ["Costo de envío en cambios", f.exchangeShippingCost],
  ]);

  addSection("6. GARANTÍAS", [
    ["Plazos de garantía por tipo de producto", f.warrantyDuration],
    ["Qué SÍ cubre la garantía", f.warrantyCovers],
    ["Qué NO cubre la garantía", f.warrantyExcludes],
    ["Pasos para aplicar la garantía", f.warrantySteps],
  ]);

  addSection("7. PRECIOS, DESCUENTOS, FACTURA ELECTRÓNICA Y PROVEEDORES", [
    ["Precios web vs. tienda física", f.webVsStorePrices],
    ["Descuentos por cantidad / equipos y autorización", f.discountsPolicy],
    ["Promociones vigentes", f.promotionsPolicy],
    ["Datos obligatorios para Factura Electrónica", f.electronicInvoiceData],
    ["Atención a proveedores que ofrecen productos", f.suppliersProtocol],
  ]);

  lines.push(`${WIZARD_MARKER}${JSON.stringify(f)}-->`);
  return lines.join("\n");
}

function extractTrainingFromDocs(docs: KnowledgeDoc[]): { docId: string | null; form: TrainingForm } {
  const existing = docs.find(
    (d) => d.title === WIZARD_DOC_TITLE || d.content.includes(WIZARD_MARKER)
  );
  if (!existing) return { docId: null, form: { ...EMPTY_TRAINING } };
  const idx = existing.content.indexOf(WIZARD_MARKER);
  if (idx >= 0) {
    const end = existing.content.indexOf("-->", idx);
    if (end > idx) {
      try {
        const parsed = JSON.parse(existing.content.slice(idx + WIZARD_MARKER.length, end));
        return { docId: existing.id, form: { ...EMPTY_TRAINING, ...parsed } };
      } catch {
        // ignore
      }
    }
  }
  return { docId: existing.id, form: { ...EMPTY_TRAINING } };
}

export default function ConocimientoPage() {
  const [activeTab, setActiveTab] = useState<"wizard" | "docs">("wizard");
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [wizardDocId, setWizardDocId] = useState<string | null>(null);
  const [training, setTraining] = useState<TrainingForm>({ ...EMPTY_TRAINING });
  const [savingWizard, setSavingWizard] = useState(false);

  // Manual upload / edit doc state
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Políticas y Precios");
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await fetch("/api/knowledge");
    const data = await res.json();
    const list: KnowledgeDoc[] = data.documents || [];
    setDocs(list);
    const extracted = extractTrainingFromDocs(list);
    setWizardDocId(extracted.docId);
    if (extracted.docId) {
      setTraining(extracted.form);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filledCount = [
    training.storesAddresses || training.storesHours,
    training.layawayPolicy || training.specialOrders,
    training.paymentMethods || training.installments || training.creditAgreements,
    training.shippingCarrier || training.shippingCost,
    training.exchangePolicy || training.refundPolicy,
    training.warrantyDuration || training.warrantyCovers,
    training.discountsPolicy || training.electronicInvoiceData,
  ].filter((v) => String(v || "").trim().length > 0).length;

  const saveWizard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWizard(true);
    setMsg("");
    try {
      const md = buildMarkdownFromTraining(training);
      const res = await fetch("/api/knowledge", {
        method: wizardDocId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          wizardDocId
            ? {
                id: wizardDocId,
                title: WIZARD_DOC_TITLE,
                category: "Entrenamiento IA",
                content: md,
                active: true,
              }
            : {
                title: WIZARD_DOC_TITLE,
                category: "Entrenamiento IA",
                fileName: "cuestionario-entrenamiento-ia.md",
                content: md,
                active: true,
              }
        ),
      });
      if (res.ok) {
        setMsg(
          "✅ ¡Cuestionario guardado y activado! Tu Agente de IA ya conoce todas las respuestas de tu empresa y las usará automáticamente en WhatsApp, Instagram, Messenger y Correo."
        );
        await load();
      } else {
        const d = await res.json().catch(() => ({}));
        setMsg(`❌ ${d.error || "No se pudo guardar el cuestionario."}`);
      }
    } finally {
      setSavingWizard(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFileName(file.name);
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
    setContent(text.slice(0, 15000));
    setMsg(`Archivo "${file.name}" leído. Revisa el contenido y haz clic en Guardar.`);
    e.target.value = "";
  };

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/knowledge", {
        method: editingDocId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingDocId
            ? { id: editingDocId, title, category, content }
            : { title, category, fileName, content }
        ),
      });
      if (res.ok) {
        setEditingDocId(null);
        setTitle("");
        setFileName("");
        setContent("");
        setMsg("✅ Documento guardado: el Agente de IA ya puede responder usando esta información.");
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
    if (id === wizardDocId) {
      setWizardDocId(null);
      setTraining({ ...EMPTY_TRAINING });
    }
    load();
  };

  const patchT = (patch: Partial<TrainingForm>) => setTraining((prev) => ({ ...prev, ...patch }));

  return (
    <div className="space-y-6">
      {/* Header + Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#0070C0]" />
            Conocimiento y Docs (Cerebro del Agente IA)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Completa el cuestionario guiado o sube documentos (horarios, precios, políticas). Todo lo activo entrena al instante a tu Agente de IA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("wizard")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "wizard"
                ? "bg-[#22115d] text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            1. Cuestionario Guiado IA ({filledCount}/7)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("docs")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "docs"
                ? "bg-[#0070C0] text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <FileText className="w-4 h-4" />
            2. Documentos y Archivos ({docs.length})
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> {msg}
          </span>
          <button onClick={() => setMsg("")} className="font-bold ml-3">✕</button>
        </div>
      )}

      {/* ================= TAB 1: GUIDED AI TRAINING QUESTIONNAIRE ================= */}
      {activeTab === "wizard" && (
        <form onSubmit={saveWizard} className="space-y-5 text-sm">
          <div className="bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-extrabold text-[#22115d] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#0070C0]" />
                Asistente Guiado de Entrenamiento del Bot (para cualquier empresa)
              </div>
              <p className="text-xs text-slate-600">
                Responde solo las preguntas que apliquen a tu negocio y presiona <strong>Guardar y Entrenar IA</strong>. Puedes actualizar cualquier respuesta cuando quieras (sin duplicar documentos).
              </p>
            </div>
            <button
              type="submit"
              disabled={savingWizard}
              className="px-5 py-2.5 bg-[#22115d] hover:bg-indigo-900 text-white text-xs font-bold rounded-xl shadow-sm shrink-0"
            >
              {savingWizard ? "Guardando..." : "✨ Guardar y Entrenar IA"}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. TIENDAS Y HORARIOS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Store className="w-4 h-4 text-[#0070C0]" /> 1. Tiendas, Direcciones y Horarios
              </h2>
              <div>
                <label className="text-xs font-semibold text-slate-600">Dirección de cada tienda o sucursal (con señas para llegar)</label>
                <textarea
                  rows={3}
                  value={training.storesAddresses}
                  onChange={(e) => patchT({ storesAddresses: e.target.value })}
                  placeholder="Ej. Sucursal #1: frente al parque central. Sucursal #2: 100 m sur del banco..."
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Horario de cada tienda (entre semana, sábado y domingo)</label>
                <textarea
                  rows={2}
                  value={training.storesHours}
                  onChange={(e) => patchT({ storesHours: e.target.value })}
                  placeholder="Ej. Lunes a sábado 9:00 am a 6:00 pm. Domingos cerrado."
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Feriados (¿cierran o trabajan normal?)</label>
                  <input
                    value={training.holidays}
                    onChange={(e) => patchT({ holidays: e.target.value })}
                    placeholder="Ej. Feriados cerrado excepto 1 de diciembre"
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">WhatsApp / Teléfonos por sucursal</label>
                  <input
                    value={training.branchPhones}
                    onChange={(e) => patchT({ branchPhones: e.target.value })}
                    placeholder="Ej. Sucursal Fortuna: 8495-1975"
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Si un cliente deja algo para retirar, ¿cuánto tiempo se guarda?</label>
                <input
                  value={training.pickupHoldTime}
                  onChange={(e) => patchT({ pickupHoldTime: e.target.value })}
                  placeholder="Ej. El tiempo que indique el cliente / 15 días"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {/* 2. APARTADOS Y ENCARGOS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Tag className="w-4 h-4 text-purple-600" /> 2. Apartados y Pedidos por Encargo
              </h2>
              <div>
                <label className="text-xs font-semibold text-slate-600">¿Hacen apartados? ¿Con cuánto se aparta (monto o porcentaje)?</label>
                <input
                  value={training.layawayPolicy}
                  onChange={(e) => patchT({ layawayPolicy: e.target.value })}
                  placeholder="Ej. Sí, se aparta con la tercera parte (1/3) del valor del artículo"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Plazo para cancelar el apartado y qué pasa si se vence</label>
                <textarea
                  rows={2}
                  value={training.layawayDeadline}
                  onChange={(e) => patchT({ layawayDeadline: e.target.value })}
                  placeholder="Ej. 2 meses para cancelar; si se pasa se conversa para llegar a un acuerdo"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Si buscan algo que no hay en stock, ¿lo encargan? (adelanto y días)</label>
                <textarea
                  rows={3}
                  value={training.specialOrders}
                  onChange={(e) => patchT({ specialOrders: e.target.value })}
                  placeholder="Ej. Sí traemos artículos por encargo con 1/3 de adelanto, tardan 4-5 días y al llegar cancelan el saldo"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {/* 3. FORMAS DE PAGO Y CRÉDITOS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <CreditCard className="w-4 h-4 text-emerald-600" /> 3. Formas de Pago, Plazos y Créditos
              </h2>
              <div>
                <label className="text-xs font-semibold text-slate-600">Formas de pago aceptadas</label>
                <input
                  value={training.paymentMethods}
                  onChange={(e) => patchT({ paymentMethods: e.target.value })}
                  placeholder="Ej. SINPE Móvil, Link de pago, depósito bancario, efectivo y tarjeta"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Tasa Cero o pagos a plazos con tarjeta (bancos, meses y condiciones)</label>
                <textarea
                  rows={2}
                  value={training.installments}
                  onChange={(e) => patchT({ installments: e.target.value })}
                  placeholder="Ej. Tasa Cero a 3 meses y BCR a 3 y 6 meses únicamente en tienda física"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Créditos o convenios especiales (cooperativas, asociaciones, descuentos)</label>
                <textarea
                  rows={3}
                  value={training.creditAgreements}
                  onChange={(e) => patchT({ creditAgreements: e.target.value })}
                  placeholder="Ej. Crédito con Coopelesca: estudio con cédula, proforma, firma y orden de compra (10% contado/crédito, 15% Bienestar)..."
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {/* 4. ENVÍOS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Truck className="w-4 h-4 text-sky-600" /> 4. Envíos y Datos de Entrega
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Medio de envío</label>
                  <input
                    value={training.shippingCarrier}
                    onChange={(e) => patchT({ shippingCarrier: e.target.value })}
                    placeholder="Ej. Correos de CR / Mensajero"
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Costo del envío</label>
                  <input
                    value={training.shippingCost}
                    onChange={(e) => patchT({ shippingCost: e.target.value })}
                    placeholder="Ej. ₡3.000 a todo el país"
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Tiempo de entrega</label>
                  <input
                    value={training.shippingEta}
                    onChange={(e) => patchT({ shippingEta: e.target.value })}
                    placeholder="Ej. 3 a 4 días hábiles"
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Datos obligatorios que el bot debe pedir para despachar un envío</label>
                <textarea
                  rows={3}
                  value={training.shippingDataNeeded}
                  onChange={(e) => patchT({ shippingDataNeeded: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {/* 5. CAMBIOS Y DEVOLUCIONES */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <RefreshCcw className="w-4 h-4 text-amber-600" /> 5. Cambios y Devoluciones
              </h2>
              <div>
                <label className="text-xs font-semibold text-slate-600">¿Aceptan cambios? ¿En cuántos días y en qué condiciones?</label>
                <textarea
                  rows={2}
                  value={training.exchangePolicy}
                  onChange={(e) => patchT({ exchangePolicy: e.target.value })}
                  placeholder="Ej. 1 mes para cambios, producto limpio con etiquetas y suela limpia"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">¿Devuelven el dinero o solo cambio / saldo a favor?</label>
                <input
                  value={training.refundPolicy}
                  onChange={(e) => patchT({ refundPolicy: e.target.value })}
                  placeholder="Ej. No se devuelve dinero; se hace cambio o saldo a favor"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">En compras por envío, ¿quién paga el envío del cambio?</label>
                <input
                  value={training.exchangeShippingCost}
                  onChange={(e) => patchT({ exchangeShippingCost: e.target.value })}
                  placeholder="Ej. El cliente asume los envíos, salvo error de la tienda"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {/* 6. GARANTÍAS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-700" /> 6. Política de Garantías
              </h2>
              <div>
                <label className="text-xs font-semibold text-slate-600">Plazos de garantía (productos generales y especiales)</label>
                <textarea
                  rows={2}
                  value={training.warrantyDuration}
                  onChange={(e) => patchT({ warrantyDuration: e.target.value })}
                  placeholder="Ej. 1 mes general por defectos de fábrica; relojes Garmin 1 año; máquinas Cicadex 1 año"
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Qué SÍ cubre</label>
                  <textarea
                    rows={2}
                    value={training.warrantyCovers}
                    onChange={(e) => patchT({ warrantyCovers: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Qué NO cubre</label>
                  <textarea
                    rows={2}
                    value={training.warrantyExcludes}
                    onChange={(e) => patchT({ warrantyExcludes: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Pasos para solicitar garantía</label>
                <input
                  value={training.warrantySteps}
                  onChange={(e) => patchT({ warrantySteps: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {/* 7. PRECIOS, DESCUENTOS, FACTURA ELECTRÓNICA Y PROVEEDORES */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-[#22115d]" /> 7. Precios, Descuentos, Factura Electrónica y Proveedores
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600">¿Los precios web son los mismos que en tienda?</label>
                  <input
                    value={training.webVsStorePrices}
                    onChange={(e) => patchT({ webVsStorePrices: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Descuentos por cantidad / equipos y quién los autoriza</label>
                  <input
                    value={training.discountsPolicy}
                    onChange={(e) => patchT({ discountsPolicy: e.target.value })}
                    placeholder="Ej. 5% general, 10% escuelas y equipos (autoriza el encargado)"
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Promociones que el bot deba conocer</label>
                  <input
                    value={training.promotionsPolicy}
                    onChange={(e) => patchT({ promotionsPolicy: e.target.value })}
                    placeholder="Ej. Cambian según temporada sin fecha fija"
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Datos obligatorios para Factura Electrónica</label>
                  <input
                    value={training.electronicInvoiceData}
                    onChange={(e) => patchT({ electronicInvoiceData: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Protocolo cuando escribe un proveedor ofreciendo productos</label>
                  <input
                    value={training.suppliersProtocol}
                    onChange={(e) => patchT({ suppliersProtocol: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingWizard}
              className="px-6 py-3 bg-[#22115d] hover:bg-indigo-900 text-white text-sm font-bold rounded-xl shadow-sm inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {savingWizard ? "Guardando entrenamiento..." : "Guardar Cuestionario y Entrenar IA Ahora"}
            </button>
          </div>
        </form>
      )}

      {/* ================= TAB 2: FREE DOCUMENTS & FILE UPLOAD ================= */}
      {activeTab === "docs" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveDoc}
            className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3.5 text-sm h-fit"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold text-slate-900">
                {editingDocId ? "Editar Documento" : "Cargar Nuevo Documento o Ficha"}
              </h2>
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
                placeholder="Ej. Horario Navideño 2026"
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
                <option value="Entrenamiento IA">Entrenamiento IA</option>
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
                placeholder="Pega aquí horarios, garantías, precios especiales o información que el asistente debe saber..."
                className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 bg-[#0070C0] hover:bg-[#005a9e] text-white font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />{" "}
                {saving ? "Guardando..." : editingDocId ? "Guardar Cambios" : "Guardar en Base de Conocimiento"}
              </button>
              {editingDocId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingDocId(null);
                    setTitle("");
                    setContent("");
                  }}
                  className="px-3 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="lg:col-span-7 space-y-3">
            <h2 className="text-sm font-bold text-slate-700">
              Documentos cargados ({docs.length})
            </h2>
            {docs.map((d) => {
              const displayContent = d.content.includes(WIZARD_MARKER)
                ? d.content.slice(0, d.content.indexOf(WIZARD_MARKER)).trim()
                : d.content;
              return (
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
                        onClick={() => {
                          if (d.id === wizardDocId) {
                            setActiveTab("wizard");
                          } else {
                            setEditingDocId(d.id);
                            setTitle(d.title);
                            setCategory(d.category);
                            setContent(d.content);
                          }
                        }}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-100 max-h-36 overflow-y-auto">
                    {displayContent}
                  </p>
                </div>
              );
            })}
            {docs.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                Aún no hay documentos cargados. Completa el Cuestionario Guiado IA o sube tu primer archivo aquí.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
