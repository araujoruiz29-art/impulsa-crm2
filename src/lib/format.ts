export const CLIENT_STAGES = [
  { id: "NUEVO", label: "Nuevo Lead", color: "bg-sky-100 text-sky-800 border-sky-200", dot: "bg-sky-500" },
  { id: "CONTACTADO", label: "Contactado", color: "bg-indigo-100 text-indigo-800 border-indigo-200", dot: "bg-indigo-500" },
  { id: "COTIZADO", label: "Proforma Enviada", color: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  { id: "SEGUIMIENTO", label: "En Seguimiento", color: "bg-purple-100 text-purple-800 border-purple-200", dot: "bg-purple-500" },
  { id: "NEGOCIACION", label: "Negociación", color: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  { id: "GANADO", label: "Ganado", color: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  { id: "PERDIDO", label: "Perdido", color: "bg-rose-100 text-rose-800 border-rose-200", dot: "bg-rose-500" },
] as const;

export const CLIENT_SOURCES = [
  { id: "WHATSAPP", label: "WhatsApp" },
  { id: "CORREO", label: "Correo Corporativo" },
  { id: "META_ADS", label: "Meta Ads (Lead Ads)" },
  { id: "FACEBOOK", label: "Facebook Messenger" },
  { id: "INSTAGRAM", label: "Instagram DM" },
  { id: "REFERIDO", label: "Referido" },
  { id: "MANUAL", label: "Manual / Teléfono" },
] as const;

export const PRODUCT_CATEGORIES = [
  "Uniformes",
  "Bordados",
  "Artículos Promocionales",
  "Artículos Deportivos",
  "Zapatos de Seguridad",
] as const;

export const TAX_MODES = [
  { id: "IVA_INCLUIDO", label: "IVA 13% Incluido (₡)" },
  { id: "DESGLOSADO", label: "IVA 13% Desglosado (+13%)" },
  { id: "EXONERADO", label: "Exonerado (0% IVA)" },
] as const;

export const QUOTE_STATUSES = [
  { id: "BORRADOR", label: "Borrador", color: "bg-slate-100 text-slate-700" },
  { id: "ENVIADA", label: "Enviada", color: "bg-sky-100 text-sky-800" },
  { id: "SEGUIMIENTO", label: "En Seguimiento", color: "bg-amber-100 text-amber-800" },
  { id: "APROBADA", label: "Aprobada", color: "bg-emerald-100 text-emerald-800" },
  { id: "RECHAZADA", label: "Rechazada", color: "bg-rose-100 text-rose-800" },
] as const;

export function formatMoney(amount: number, currency: string = "CRC"): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const fixed = safe.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (currency === "USD") {
    return `$${grouped.replace(/ /g, ",")}.${decPart}`;
  }
  return `₡${grouped},${decPart}`;
}

export function formatNumberCR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const [intPart, decPart] = safe.toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped},${decPart}`;
}

export function formatDateCR(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return "";
  const months = [
    "ene.", "feb.", "mar.", "abr.", "may.", "jun.",
    "jul.", "ago.", "set.", "oct.", "nov.", "dic.",
  ];
  const day = String(d.getDate()).padStart(2, "0");
  const mon = months[d.getMonth()];
  const yr = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${yr}`;
}

export function normalizeCRPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 8) return `506${digits}`;
  return digits;
}

export function sanitizeFilename(name: string): string {
  return (name || "Cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s\-_]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 60);
}

export interface CalcItem {
  quantity: number;
  unitPrice: number;
}

export function calculateQuoteTotals(
  items: CalcItem[],
  taxMode: string = "IVA_INCLUIDO",
  taxRate: number = 0.13,
  discountAmount: number = 0
) {
  const subtotal = items.reduce((acc, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return acc + qty * price;
  }, 0);

  const safeDiscount = Math.max(0, Math.min(Number(discountAmount) || 0, subtotal));
  const netAfterDiscount = Math.max(0, subtotal - safeDiscount);

  let taxAmount = 0;
  let total = netAfterDiscount;
  let includedTaxInfo = 0;

  if (taxMode === "DESGLOSADO") {
    taxAmount = Number((netAfterDiscount * taxRate).toFixed(2));
    total = Number((netAfterDiscount + taxAmount).toFixed(2));
  } else if (taxMode === "IVA_INCLUIDO") {
    taxAmount = 0;
    total = Number(netAfterDiscount.toFixed(2));
    includedTaxInfo = Number((total - total / (1 + taxRate)).toFixed(2));
  } else {
    taxAmount = 0;
    total = Number(netAfterDiscount.toFixed(2));
  }

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(safeDiscount.toFixed(2)),
    taxAmount,
    total,
    includedTaxInfo,
  };
}
