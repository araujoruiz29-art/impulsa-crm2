"use client";

import React, { useEffect, useState } from "react";
import {
  Building2,
  Mail,
  MessageCircle,
  Bot,
  ShieldCheck,
  Save,
  Copy,
  Download,
  RefreshCw,
  Plus,
  Trash2,
  Users,
  Crown,
  Upload,
  KeyRound,
  Power,
} from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

interface AdminCompanyRow {
  id: string;
  brandName: string;
  companyName: string;
  email: string;
  phone: string;
  active: boolean;
  plan: string;
  suspendedReason: string;
  createdAt: string;
  ownerEmail: string;
  ownerName: string;
  ownerUserId: string;
  stats: {
    clientsCount: number;
    conversationsCount: number;
    quotesCount: number;
    agentsCount: number;
  };
  connections: {
    whatsapp: boolean;
    social: boolean;
    email: boolean;
    ai: boolean;
  };
}

interface BankAccount {
  bank: string;
  accountNumber: string;
  iban: string;
}

interface EmailAccountItem {
  id?: string;
  label: string;
  email: string;
  fromName: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPass: string;
  isDefault: boolean;
  active: boolean;
}

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<"company" | "email" | "meta" | "ai" | "backup" | "team" | "admin">("company");
  const [company, setCompany] = useState<Record<string, unknown>>({});
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [integrations, setIntegrations] = useState<Record<string, unknown>>({});
  const [emailAccounts, setEmailAccounts] = useState<EmailAccountItem[]>([]);
  const [userRole, setUserRole] = useState<string>("OWNER");
  const [teamOwner, setTeamOwner] = useState<TeamMember | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [canManageTeam, setCanManageTeam] = useState(true);
  const [newSeller, setNewSeller] = useState({ name: "", email: "", password: "" });
  const [adminCompanies, setAdminCompanies] = useState<AdminCompanyRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [testWaPhone, setTestWaPhone] = useState("8449-1975");

  const loadAdminCompanies = async () => {
    const r = await fetch("/api/admin/companies");
    if (r.ok) {
      const d = await r.json();
      setAdminCompanies(d.companies || []);
    }
  };

  const loadTeam = async () => {
    const r = await fetch("/api/team");
    if (r.ok) {
      const d = await r.json();
      setTeamOwner(d.owner || null);
      setTeamMembers(d.members || []);
      setCanManageTeam(Boolean(d.canManage));
    }
  };

  const load = async () => {
    const [res, accRes, wsRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/email-accounts"),
      fetch("/api/workspaces"),
    ]);
    const [data, accData, wsData] = await Promise.all([res.json(), accRes.json(), wsRes.json()]);
    setCompany(data.company || {});
    setBankAccounts(data.company?.bankAccounts || []);
    setIntegrations(data.integrations || {});
    setEmailAccounts(accData.accounts || []);
    const role = String(wsData?.role || "OWNER");
    setUserRole(role);
    loadTeam();
    if (role === "SUPERADMIN") {
      loadAdminCompanies();
    }
  };

  const handleLogoUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setStatusMsg("❌ Selecciona un archivo de imagen PNG, JPG o WebP.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 420;
        const maxH = 140;
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/png");
        setCompany((prev) => ({ ...prev, logoPath: dataUrl }));
        setStatusMsg("✅ Logo cargado. Haz clic en «Guardar Configuración» abajo para aplicarlo en tus Proformas PDF.");
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    load();
  }, []);

  const saveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: { ...company, bankAccounts },
          integrations,
        }),
      });
      if (res.ok) {
        setStatusMsg("✅ Configuración guardada correctamente en la base de datos local.");
      }
    } finally {
      setSaving(false);
    }
  };

  const saveEmailAccount = async (acc: EmailAccountItem) => {
    setTesting(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/email-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(acc),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg(`✅ Cuenta ${acc.email} guardada correctamente.`);
        await load();
        return data.account?.id as string | undefined;
      } else {
        setStatusMsg(`❌ ${data.error || "Error guardando cuenta."}`);
      }
    } finally {
      setTesting(false);
    }
    return undefined;
  };

  const deleteEmailAccount = async (id?: string) => {
    if (!id) {
      setEmailAccounts((prev) => prev.filter((a) => a.id));
      return;
    }
    if (!confirm("¿Eliminar esta cuenta de correo?")) return;
    await fetch(`/api/email-accounts?id=${id}`, { method: "DELETE" });
    load();
  };

  const testMailAccount = async (acc: EmailAccountItem, action: "test_smtp" | "test_imap" | "sync") => {
    setTesting(true);
    setStatusMsg("");
    try {
      const savedId = await saveEmailAccount(acc);
      const res = await fetch("/api/email/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, accountId: savedId || acc.id }),
      });
      const data = await res.json();
      setStatusMsg(data.ok ? `✅ ${data.message}` : `❌ ${data.error}`);
    } finally {
      setTesting(false);
    }
  };

  const addNewMailboxCard = () => {
    setEmailAccounts((prev) => [
      ...prev,
      {
        label: "Nueva Cuenta",
        email: "",
        fromName: String(company.brandName || "Caminante Corporativo"),
        smtpHost: "mail.elcaminantecr.com",
        smtpPort: 465,
        smtpSecure: true,
        smtpUser: "",
        smtpPass: "",
        imapHost: "mail.elcaminantecr.com",
        imapPort: 993,
        imapSecure: true,
        imapUser: "",
        imapPass: "",
        isDefault: prev.length === 0,
        active: true,
      },
    ]);
  };

  const testMetaApi = async (
    action: "verify" | "send_test" | "verify_social",
    mode: "template" | "text" = "template"
  ) => {
    setTesting(true);
    setStatusMsg("");
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrations }),
      });
      const res = await fetch("/api/meta/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, to: testWaPhone, mode }),
      });
      const data = await res.json();
      if (data.ok && data.metaIgAccountId) {
        setIntegrations((prev) => ({ ...prev, metaIgAccountId: data.metaIgAccountId }));
      }
      setStatusMsg(data.ok ? `✅ ${data.message}` : `❌ ${data.error}`);
    } finally {
      setTesting(false);
    }
  };

  const webhookEndpoint =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/meta`
      : "http://localhost:3000/api/webhooks/meta";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración, Integraciones y Respaldos</h1>
        <p className="text-sm text-slate-500">
          Conecta tu correo corporativo (SMTP/IMAP), Meta Cloud API (WhatsApp, Messenger, IG, Lead Ads), Agente de IA y los datos de tu Factura Proforma.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "company", label: "Empresa y Proforma", icon: Building2 },
          { id: "email", label: "Correo SMTP / IMAP", icon: Mail },
          { id: "meta", label: "Meta Cloud API & WhatsApp", icon: MessageCircle },
          { id: "ai", label: "Agente de IA", icon: Bot },
          { id: "team", label: "Equipo y Vendedores", icon: Users },
          { id: "backup", label: "Respaldos y Nube", icon: ShieldCheck },
          ...(userRole === "SUPERADMIN"
            ? [{ id: "admin", label: "Admin Compañías (SaaS)", icon: Crown }]
            : []),
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                tab === t.id
                  ? "bg-[#0070C0] text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs font-medium text-sky-900 flex items-center justify-between">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg("")}>✕</button>
        </div>
      )}

      <form onSubmit={saveAll} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        {/* TAB 1: COMPANY */}
        {tab === "company" && (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-slate-900">Identidad Visual, Marca y Datos de Proforma PDF</h2>

            {/* Brand Colors & Logo per Company (Multi-tenant branding) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 items-center text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-600">Nombre Comercial (Workspace)</label>
                <input
                  value={String(company.brandName || "")}
                  onChange={(e) => setCompany({ ...company, brandName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Color principal de la interfaz</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={String(company.primaryColor || "#1E1046")}
                    onChange={(e) => setCompany({ ...company, primaryColor: e.target.value })}
                    className="h-9 w-12 rounded-lg border border-slate-200 cursor-pointer"
                  />
                  {[
                    { label: "Impulsa", hex: "#1E1046" },
                    { label: "Caminante", hex: "#0070C0" },
                    { label: "Esmeralda", hex: "#065F46" },
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.hex}
                      onClick={() => setCompany({ ...company, primaryColor: p.hex })}
                      className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 block">
                  Logotipo de la Empresa (sale en Proformas PDF)
                </label>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {String(company.logoPath || "").trim() ? (
                    <img
                      src={String(company.logoPath)}
                      alt="Logo empresa"
                      className="h-10 max-w-[140px] object-contain bg-white border border-slate-200 rounded-lg p-1"
                    />
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Sin logo</span>
                  )}
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0070C0] hover:bg-[#005a9e] text-white text-xs font-bold rounded-lg cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> Subir Logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleLogoUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {String(company.logoPath || "").trim() && (
                    <button
                      type="button"
                      onClick={() => setCompany({ ...company, logoPath: "" })}
                      className="px-2 py-1.5 text-[11px] font-semibold bg-white border border-slate-200 text-rose-600 rounded-lg hover:bg-rose-50"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-600">Razón Social</label>
                <input
                  value={String(company.companyName || "")}
                  onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Cédula Jurídica</label>
                <input
                  value={String(company.legalId || "")}
                  onChange={(e) => setCompany({ ...company, legalId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Dirección</label>
                <input
                  value={String(company.address || "")}
                  onChange={(e) => setCompany({ ...company, address: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Teléfono oficina</label>
                <input
                  value={String(company.phone || "")}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">WhatsApp comercial</label>
                <input
                  value={String(company.whatsapp || "")}
                  onChange={(e) => setCompany({ ...company, whatsapp: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">SINPE Móvil</label>
                <input
                  value={String(company.sinpePhone || "")}
                  onChange={(e) => setCompany({ ...company, sinpePhone: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Siguiente N.º de Proforma</label>
                <input
                  type="number"
                  value={Number(company.nextQuoteNumber || 1409)}
                  onChange={(e) => setCompany({ ...company, nextQuoteNumber: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl font-bold text-rose-700"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Correo Ventas</label>
                <input
                  value={String(company.email || "")}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Correo Factura Electrónica</label>
                <input
                  value={String(company.billingEmail || "")}
                  onChange={(e) => setCompany({ ...company, billingEmail: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Frase pie de página (Banner azul)</label>
                <input
                  value={String(company.footerMotto || "")}
                  onChange={(e) => setCompany({ ...company, footerMotto: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Cuentas Bancarias (PDF Proforma)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bankAccounts.map((b, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <input
                      value={b.bank}
                      onChange={(e) => {
                        const next = [...bankAccounts];
                        next[i] = { ...b, bank: e.target.value };
                        setBankAccounts(next);
                      }}
                      placeholder="Nombre del banco"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold"
                    />
                    <input
                      value={b.accountNumber}
                      onChange={(e) => {
                        const next = [...bankAccounts];
                        next[i] = { ...b, accountNumber: e.target.value };
                        setBankAccounts(next);
                      }}
                      placeholder="Cuenta corriente"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      value={b.iban}
                      onChange={(e) => {
                        const next = [...bankAccounts];
                        next[i] = { ...b, iban: e.target.value };
                        setBankAccounts(next);
                      }}
                      placeholder="Cuenta IBAN (CR...)"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EMAIL SMTP/IMAP (Multi-Account) */}
        {tab === "email" && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Cuentas de Correo Corporativo (SMTP + IMAP)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conecta múltiples correos en la misma empresa (ej. <code>ventas@elcaminantecr.com</code> y <code>uniformes@elcaminantecr.com</code>). Solo ingresa la contraseña de cada cuenta y pulsa Probar.
                </p>
              </div>
              <button
                type="button"
                onClick={addNewMailboxCard}
                className="btn-brand inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl shrink-0"
              >
                <Plus className="w-4 h-4" /> Agregar otro correo
              </button>
            </div>

            <div className="space-y-4">
              {emailAccounts.map((acc, idx) => {
                const patchAcc = (patch: Partial<EmailAccountItem>) => {
                  setEmailAccounts((prev) =>
                    prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
                  );
                };
                return (
                  <div
                    key={acc.id || `new-${idx}`}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-[#22115d]" />
                        <span className="font-bold text-slate-900">
                          {acc.email || "Nueva cuenta corporativa"}
                        </span>
                        {acc.isDefault && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900">
                            Predeterminada
                          </span>
                        )}
                        {acc.smtpPass && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Contraseña guardada
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={testing}
                          onClick={() => saveEmailAccount(acc)}
                          className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          disabled={testing}
                          onClick={() => testMailAccount(acc, "test_smtp")}
                          className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-[#0070C0] rounded-lg hover:bg-sky-50"
                        >
                          Probar SMTP
                        </button>
                        <button
                          type="button"
                          disabled={testing}
                          onClick={() => testMailAccount(acc, "test_imap")}
                          className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-emerald-700 rounded-lg hover:bg-emerald-50"
                        >
                          Probar IMAP
                        </button>
                        <button
                          type="button"
                          disabled={testing}
                          onClick={() => testMailAccount(acc, "sync")}
                          className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        >
                          Sincronizar INBOX
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEmailAccount(acc.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                          title="Eliminar cuenta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Etiqueta (ej. Ventas / Uniformes)</label>
                        <input
                          value={acc.label}
                          onChange={(e) => patchAcc({ label: e.target.value })}
                          className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Correo electrónico *</label>
                        <input
                          type="email"
                          value={acc.email}
                          onChange={(e) =>
                            patchAcc({
                              email: e.target.value,
                              smtpUser: e.target.value,
                              imapUser: e.target.value,
                            })
                          }
                          placeholder="ventas@elcaminantecr.com"
                          className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Nombre remitente</label>
                        <input
                          value={acc.fromName}
                          onChange={(e) => patchAcc({ fromName: e.target.value })}
                          className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Contraseña (SMTP & IMAP)</label>
                        <input
                          type="password"
                          value={acc.smtpPass}
                          onChange={(e) =>
                            patchAcc({ smtpPass: e.target.value, imapPass: e.target.value })
                          }
                          placeholder="Escribe la contraseña de este correo"
                          className="w-full mt-1 px-3 py-2 bg-white border border-indigo-200 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600">Servidor SMTP</label>
                        <input
                          value={acc.smtpHost}
                          onChange={(e) => patchAcc({ smtpHost: e.target.value })}
                          className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Puerto SMTP (465 SSL)</label>
                        <input
                          type="number"
                          value={acc.smtpPort}
                          onChange={(e) => patchAcc({ smtpPort: Number(e.target.value) })}
                          className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Servidor IMAP</label>
                        <input
                          value={acc.imapHost}
                          onChange={(e) => patchAcc({ imapHost: e.target.value })}
                          className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Puerto IMAP (993 SSL)</label>
                        <input
                          type="number"
                          value={acc.imapPort}
                          onChange={(e) => patchAcc({ imapPort: Number(e.target.value) })}
                          className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      <label className="flex items-center gap-1.5 font-medium">
                        <input
                          type="checkbox"
                          checked={acc.smtpSecure}
                          onChange={(e) => patchAcc({ smtpSecure: e.target.checked, imapSecure: e.target.checked })}
                        />
                        SSL/TLS activado (465 / 993)
                      </label>
                      <label className="flex items-center gap-1.5 font-medium">
                        <input
                          type="checkbox"
                          checked={acc.isDefault}
                          onChange={(e) => patchAcc({ isDefault: e.target.checked })}
                        />
                        Usar como correo predeterminado al enviar Proformas
                      </label>
                    </div>
                  </div>
                );
              })}
              {emailAccounts.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  No hay cuentas de correo en esta empresa todavía. Haz clic en &ldquo;Agregar otro correo&rdquo;.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: META CLOUD API */}
        {tab === "meta" && (
          <div className="space-y-5 text-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Meta Cloud API Oficial (WhatsApp Business + Messenger + Instagram + Lead Ads)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tu CRM ya expone el Webhook oficial listo para recibir mensajes de WhatsApp, Messenger, Instagram y formularios de Meta Ads.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 text-xs">
              <div className="font-bold text-emerald-900">URL del Webhook de tu CRM (para pegar en Meta Developers → WhatsApp → Configuración):</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white px-3 py-2 rounded-lg border border-emerald-200 text-emerald-900 font-mono">
                  {integrations.metaPublicWebhookUrl
                    ? `${String(integrations.metaPublicWebhookUrl).replace(/\/$/, "")}/api/webhooks/meta`
                    : webhookEndpoint}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard?.writeText(
                      integrations.metaPublicWebhookUrl
                        ? `${String(integrations.metaPublicWebhookUrl).replace(/\/$/, "")}/api/webhooks/meta`
                        : webhookEndpoint
                    )
                  }
                  className="px-3 py-2 bg-emerald-600 text-white rounded-lg font-semibold flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" /> Copiar
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={testing}
                  onClick={() => testMetaApi("verify")}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold"
                >
                  Verificar Conexión Meta
                </button>
                <input
                  value={testWaPhone}
                  onChange={(e) => setTestWaPhone(e.target.value)}
                  placeholder="8449-1975"
                  className="w-32 px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs"
                />
                <button
                  type="button"
                  disabled={testing}
                  onClick={() => testMetaApi("send_test", "template")}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold"
                >
                  Enviar WhatsApp Prueba (hello_world)
                </button>
                <button
                  type="button"
                  disabled={testing}
                  onClick={() => testMetaApi("send_test", "text")}
                  className="px-3 py-2 bg-white border border-emerald-300 text-emerald-900 rounded-xl font-bold"
                >
                  Enviar Texto Libre
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Token de Acceso Permanente (System User Token)</label>
                <input
                  type="password"
                  value={String(integrations.metaAccessToken || "")}
                  onChange={(e) => setIntegrations({ ...integrations, metaAccessToken: e.target.value })}
                  placeholder="EAAG..."
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">WhatsApp Phone Number ID</label>
                <input
                  value={String(integrations.metaPhoneNumberId || "")}
                  onChange={(e) => setIntegrations({ ...integrations, metaPhoneNumberId: e.target.value })}
                  placeholder="1092837465..."
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">WhatsApp Business Account ID (WABA)</label>
                <input
                  value={String(integrations.metaWabaId || "")}
                  onChange={(e) => setIntegrations({ ...integrations, metaWabaId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Verify Token del Webhook</label>
                <input
                  value={String(integrations.metaVerifyToken || "caminante_meta_verify_2026")}
                  onChange={(e) => setIntegrations({ ...integrations, metaVerifyToken: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">App Secret (verificación HMAC-SHA256)</label>
                <input
                  type="password"
                  value={String(integrations.metaAppSecret || "")}
                  onChange={(e) => setIntegrations({ ...integrations, metaAppSecret: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">URL Pública HTTPS (Dominio del CRM)</label>
                <input
                  value={String(integrations.metaPublicWebhookUrl || "")}
                  onChange={(e) => setIntegrations({ ...integrations, metaPublicWebhookUrl: e.target.value })}
                  placeholder="https://impulsa-crm2.vercel.app"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Meta Ad Account ID (Opcional · Lead Ads)</label>
                <input
                  value={String(integrations.metaAdAccountId || "")}
                  onChange={(e) => setIntegrations({ ...integrations, metaAdAccountId: e.target.value })}
                  placeholder="act_123456789"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {/* Dedicated Messenger & Instagram Direct section */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#22115d]">
                    Facebook Messenger e Instagram Direct (Respuestas 2 vías + IA + Kanban)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Conecta la Página de Facebook y el Instagram Profesional de esta empresa para recibir, responder, clasificar Compra vs Consulta y acomodar clientes en Ventas Kanban automáticamente.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={testing}
                  onClick={() => testMetaApi("verify_social")}
                  className="px-3.5 py-2 bg-[#22115d] hover:bg-indigo-900 text-white rounded-xl text-xs font-bold shrink-0"
                >
                  Verificar Messenger e Instagram
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Facebook Page ID (Messenger y Lead Ads)</label>
                  <input
                    value={String(integrations.metaPageId || "")}
                    onChange={(e) => setIntegrations({ ...integrations, metaPageId: e.target.value })}
                    placeholder="109876543210987"
                    className="w-full mt-1 px-3 py-2 bg-white border border-indigo-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Instagram Business Account ID (se detecta solo al verificar)
                  </label>
                  <input
                    value={String(integrations.metaIgAccountId || "")}
                    onChange={(e) => setIntegrations({ ...integrations, metaIgAccountId: e.target.value })}
                    placeholder="17841400..."
                    className="w-full mt-1 px-3 py-2 bg-white border border-indigo-200 rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Token de Página para Messenger / Instagram (opcional si tu Token Permanente ya tiene asignada la Página)
                  </label>
                  <input
                    type="password"
                    value={String(integrations.metaPageAccessToken || "")}
                    onChange={(e) => setIntegrations({ ...integrations, metaPageAccessToken: e.target.value })}
                    placeholder="EAAG... (Page Access Token con pages_messaging e instagram_manage_messages)"
                    className="w-full mt-1 px-3 py-2 bg-white border border-indigo-200 rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AI AGENT */}
        {tab === "ai" && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">Configuración del Agente de IA y Base de Conocimiento</h2>
                <p className="text-xs text-slate-500">
                  Conecta tu llave de Gemini (recomendado: <code>gemini-flash-lite-latest</code> con respaldo automático entre modelos).
                </p>
              </div>
              <button
                type="button"
                disabled={testing}
                onClick={async () => {
                  setTesting(true);
                  setStatusMsg("");
                  try {
                    await fetch("/api/settings", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ integrations }),
                    });
                    const r = await fetch("/api/ai", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "test" }),
                    });
                    const d = await r.json();
                    setStatusMsg(d.ok ? `✅ ${d.message}` : `❌ ${d.error}`);
                  } finally {
                    setTesting(false);
                  }
                }}
                className="px-3.5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
              >
                Probar Conexión IA (Gemini)
              </button>
            </div>

            {/* Global Manual vs Automatic AI Mode */}
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                integrations.aiGlobalPaused
                  ? "bg-amber-50 border-amber-300"
                  : "bg-emerald-50/70 border-emerald-200"
              }`}
            >
              <div>
                <div className="font-bold text-slate-900 text-sm">
                  {integrations.aiGlobalPaused
                    ? "✋ Modo Actual: Respuesta 100% Manual (IA automática apagada para todo)"
                    : "🤖 Modo Actual: Respuesta Automática con IA Activa (24/7)"}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {integrations.aiGlobalPaused
                    ? "Los mensajes, audios y fotos siguen entrando a tu Bandeja, pero el bot NO responde solo. Tú respondes manualmente o usando «Sugerencia IA (Borrador)»."
                    : "El Agente IA responde automáticamente textos, notas de voz y fotos de zapatos (y se pausa solo cuando detecta intención de compra o pausas un chat individual)."}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const nextPaused = !Boolean(integrations.aiGlobalPaused);
                  setIntegrations({ ...integrations, aiGlobalPaused: nextPaused });
                  const res = await fetch("/api/settings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ integrations: { aiGlobalPaused: nextPaused } }),
                  });
                  if (res.ok) {
                    setStatusMsg(
                      nextPaused
                        ? "✅ Activado Modo Manual Total: la IA no responderá automáticamente ningún chat."
                        : "✅ Activada IA Automática 24/7."
                    );
                  }
                }}
                className={`px-4 py-2 text-xs font-bold rounded-xl shrink-0 ${
                  integrations.aiGlobalPaused
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-amber-600 hover:bg-amber-700 text-white"
                }`}
              >
                {integrations.aiGlobalPaused
                  ? "Activar IA Automática"
                  : "Cambiar a Respuesta Manual Total"}
              </button>
            </div>

            {/* AI Only for New Clients Toggle */}
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                integrations.aiOnlyNewClients
                  ? "bg-sky-50 border-sky-300"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div>
                <div className="font-bold text-slate-900 text-sm">
                  {integrations.aiOnlyNewClients
                    ? "🆕 Alcance IA: Solo Clientes Nuevos (etapa Nuevo Lead)"
                    : "🌐 Alcance IA: Todos los Clientes Comerciales"}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {integrations.aiOnlyNewClients
                    ? "La IA solo saluda y atiende automáticamente a prospectos NUEVOS. A clientes existentes (ya contactados/cotizados/ganados) y a compañeros/agentes NO les contesta sola."
                    : "La IA responde a todos los clientes comerciales (siempre excluye automáticamente a contactos marcados como Compañero/Agente o Proveedor)."}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const nextVal = !Boolean(integrations.aiOnlyNewClients);
                  setIntegrations({ ...integrations, aiOnlyNewClients: nextVal });
                  const res = await fetch("/api/settings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ integrations: { aiOnlyNewClients: nextVal } }),
                  });
                  if (res.ok) {
                    setStatusMsg(
                      nextVal
                        ? "✅ Activado: la IA ahora responderá ÚNICAMENTE a clientes nuevos (etapa Nuevo Lead)."
                        : "✅ IA configurada para atender a todos los clientes comerciales."
                    );
                  }
                }}
                className={`px-4 py-2 text-xs font-bold rounded-xl shrink-0 ${
                  integrations.aiOnlyNewClients
                    ? "bg-[#0070C0] hover:bg-[#005a9e] text-white"
                    : "bg-slate-900 hover:bg-slate-800 text-white"
                }`}
              >
                {integrations.aiOnlyNewClients
                  ? "Cambiar a Todos los Clientes"
                  : "Restringir Solo a Clientes Nuevos"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">Proveedor IA</label>
                <select
                  value={String(integrations.aiProvider || "gemini")}
                  onChange={(e) => setIntegrations({ ...integrations, aiProvider: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                >
                  <option value="gemini">Google Gemini API</option>
                  <option value="openai">OpenAI (GPT)</option>
                  <option value="local">Solo Motor Local (sin API Key)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Modelo</label>
                <input
                  value={String(integrations.aiModel || "gemini-2.5-flash")}
                  onChange={(e) => setIntegrations({ ...integrations, aiModel: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">API Key</label>
                <input
                  type="password"
                  value={String(integrations.aiApiKey || "")}
                  onChange={(e) => setIntegrations({ ...integrations, aiApiKey: e.target.value })}
                  placeholder="AIza... o sk-..."
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Instrucciones / Personalidad del Agente</label>
              <textarea
                rows={5}
                value={String(integrations.aiSystemPrompt || "")}
                onChange={(e) => setIntegrations({ ...integrations, aiSystemPrompt: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Base de Conocimiento del Negocio (políticas, tiempos, pagos)</label>
              <textarea
                rows={5}
                value={String(integrations.aiKnowledgeBase || "")}
                onChange={(e) => setIntegrations({ ...integrations, aiKnowledgeBase: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Plantilla WhatsApp cuando SÍ reconoce foto de producto
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Variables: <code>{"{{modelo}}"}</code>, <code>{"{{sku}}"}</code>, <code>{"{{precio}}"}</code>, <code>{"{{tallas}}"}</code>, <code>{"{{enlace}}"}</code>, <code>{"{{alternativa}}"}</code>
                </p>
                <textarea
                  rows={4}
                  value={String(integrations.visionFoundTemplate || "")}
                  onChange={(e) => setIntegrations({ ...integrations, visionFoundTemplate: e.target.value })}
                  placeholder="Déjalo vacío para usar el formato automático o escribe tu propio mensaje personalizado..."
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">
                  Plantilla WhatsApp cuando NO encuentra foto exacta
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Variable disponible: <code>{"{{resumen}}"}</code> (lo que vio la IA en la foto)
                </p>
                <textarea
                  rows={4}
                  value={String(integrations.visionFallbackTemplate || "")}
                  onChange={(e) => setIntegrations({ ...integrations, visionFallbackTemplate: e.target.value })}
                  placeholder="Ej. ¡Hola! Recibimos tu foto. Déjame revisarte en bodega y ya un asesor te confirma tallas y precio..."
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: BACKUP & CLOUD */}
        {tab === "backup" && (
          <div className="space-y-4 text-sm">
            <h2 className="text-base font-bold text-slate-900">Respaldos y Protección de Datos (PostgreSQL + JSON + Correo Semanal)</h2>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="text-xs text-emerald-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Respaldo Automático Semanal Activo (Domingos 2:00 AM Costa Rica)
                </div>
                <p className="text-emerald-900/80">
                  Cada domingo el sistema envía automáticamente una copia JSON adjunta al correo corporativo de tu empresa (incluye clientes, chats completos, proformas PDF, catálogo, campañas, ciclo 1-7-90, documentos IA, usuarios y conexiones).
                </p>
              </div>
              <button
                type="button"
                disabled={testing}
                onClick={async () => {
                  setTesting(true);
                  setStatusMsg("");
                  try {
                    const res = await fetch("/api/backup", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "email_now", full: true }),
                    });
                    const data = await res.json();
                    setStatusMsg(res.ok ? `✅ ${data.message}` : `❌ ${data.error}`);
                  } finally {
                    setTesting(false);
                  }
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shrink-0"
              >
                <Mail className="w-4 h-4" /> Enviar respaldo por correo ahora
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#0070C0]" /> 1. Exportar Respaldo Completo (JSON)
                </h3>
                <p className="text-xs text-slate-600">
                  Descarga un archivo JSON con <strong>empresas, usuarios, clientes, conversaciones, proformas PDF, catálogo, campañas, ciclo 1-7-90, horarios, correos y llaves</strong> para guardarlo en Drive o restaurarlo en cualquier momento.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="/api/backup?full=1"
                    className="btn-brand inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl"
                  >
                    <Download className="w-4 h-4" /> Descargar Migración Completa (JSON)
                  </a>
                  <a
                    href="/api/backup"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100"
                  >
                    Solo empresa actual
                  </a>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-sky-50 border border-sky-200 space-y-3">
                <h3 className="font-bold text-sky-900 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#0070C0]" /> 2. Restaurar Respaldo JSON
                </h3>
                <p className="text-xs text-sky-900/80">
                  Sube un archivo de respaldo <code>.json</code> para restaurar al instante clientes, chats, proformas, campañas y configuración (cada empresa solo puede restaurar su propio espacio).
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#0070C0] hover:bg-[#005a9e] text-white text-xs font-bold rounded-xl cursor-pointer">
                  Subir archivo de respaldo JSON
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setTesting(true);
                      setStatusMsg("");
                      try {
                        const text = await file.text();
                        const res = await fetch("/api/backup", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: text,
                        });
                        const data = await res.json();
                        setStatusMsg(
                          res.ok
                            ? `✅ ${data.message} (${JSON.stringify(data.counts)})`
                            : `❌ ${data.error}`
                        );
                        if (res.ok) await load();
                      } finally {
                        setTesting(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
              <h3 className="font-bold text-rose-950 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" /> 3. Limpieza de Datos de Prueba (Dejar solo Correos)
              </h3>
              <p className="text-xs text-rose-900/80">
                Elimina chats de prueba (WhatsApp / Meta / simulaciones) y los artículos demo del catálogo.{" "}
                <strong>Tus mensajes de correo corporativo, proformas, clientes, horarios y conexiones NO se borran.</strong>
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={testing}
                  onClick={async () => {
                    if (
                      !confirm(
                        "¿Eliminar TODOS los chats de prueba (dejando solo correos) y vaciar los artículos del catálogo?\n\nTus correos corporativos, proformas, clientes, horarios y llaves seguirán intactos."
                      )
                    ) {
                      return;
                    }
                    setTesting(true);
                    setStatusMsg("");
                    try {
                      const res = await fetch("/api/cleanup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          clearNonEmailConversations: true,
                          clearProducts: true,
                        }),
                      });
                      const data = await res.json();
                      setStatusMsg(res.ok ? `✅ ${data.message}` : `❌ ${data.error}`);
                    } finally {
                      setTesting(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl"
                >
                  <Trash2 className="w-4 h-4" /> Limpiar chats de prueba + catálogo (dejar solo correos)
                </button>
                <button
                  type="button"
                  disabled={testing}
                  onClick={async () => {
                    if (!confirm("¿Eliminar solo los chats que NO son de correo (WhatsApp/pruebas)?")) return;
                    setTesting(true);
                    setStatusMsg("");
                    try {
                      const res = await fetch("/api/cleanup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ clearNonEmailConversations: true }),
                      });
                      const data = await res.json();
                      setStatusMsg(res.ok ? `✅ ${data.message}` : `❌ ${data.error}`);
                    } finally {
                      setTesting(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl hover:bg-rose-100/60"
                >
                  Solo chats de prueba
                </button>
                <button
                  type="button"
                  disabled={testing}
                  onClick={async () => {
                    if (!confirm("¿Vaciar todos los artículos del Catálogo e Inventario?")) return;
                    setTesting(true);
                    setStatusMsg("");
                    try {
                      const res = await fetch("/api/cleanup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ clearProducts: true }),
                      });
                      const data = await res.json();
                      setStatusMsg(res.ok ? `✅ ${data.message}` : `❌ ${data.error}`);
                    } finally {
                      setTesting(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl hover:bg-rose-100/60"
                >
                  Solo vaciar catálogo
                </button>
                <button
                  type="button"
                  disabled={testing}
                  onClick={async () => {
                    if (
                      !confirm(
                        "¿Dejar el Tablero en CERO (borrar proformas de prueba, clientes demo sin correo, tareas demo y marcar correos como leídos)?\n\nTus mensajes de correo corporativo, horarios y conexiones de WhatsApp/IA seguirán intactos."
                      )
                    ) {
                      return;
                    }
                    setTesting(true);
                    setStatusMsg("");
                    try {
                      const res = await fetch("/api/cleanup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ clearDemoBoard: true }),
                      });
                      const data = await res.json();
                      setStatusMsg(res.ok ? `✅ ${data.message}` : `❌ ${data.error}`);
                    } finally {
                      setTesting(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl"
                >
                  <Trash2 className="w-4 h-4" /> Dejar Tablero en Cero (proformas, clientes y tareas demo)
                </button>
                <button
                  type="button"
                  disabled={testing}
                  onClick={async () => {
                    if (
                      !confirm(
                        "¿Vaciar todas las tarjetas de Ventas · Kanban (contactos)?\n\nTus mensajes de correo en Conversaciones, horarios y conexiones NO se borran."
                      )
                    ) {
                      return;
                    }
                    setTesting(true);
                    setStatusMsg("");
                    try {
                      const res = await fetch("/api/cleanup", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ clearKanbanClients: true }),
                      });
                      const data = await res.json();
                      setStatusMsg(res.ok ? `✅ ${data.message}` : `❌ ${data.error}`);
                    } finally {
                      setTesting(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl hover:bg-rose-100/60"
                >
                  <Trash2 className="w-4 h-4" /> Limpiar Ventas Kanban
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: TEAM & SELLERS */}
        {tab === "team" && (
          <div className="space-y-5 text-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Equipo y Vendedores de {String(company.brandName || "tu Empresa")}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Crea cuentas individuales para tus vendedores. Cada vendedor inicia sesión con su propio correo y contraseña, y solo puede ver y trabajar dentro de esta empresa.
              </p>
            </div>

            {teamOwner && (
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-[#22115d]">{teamOwner.name || "Dueño"}</span>{" "}
                  <span className="text-slate-600">({teamOwner.email})</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#22115d] text-white font-bold text-[10px]">
                  DUEÑO / ADMIN
                </span>
              </div>
            )}

            {canManageTeam && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800">+ Agregar nuevo vendedor</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    value={newSeller.name}
                    onChange={(e) => setNewSeller({ ...newSeller, name: e.target.value })}
                    placeholder="Nombre (ej. María Pérez)"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                  <input
                    type="email"
                    value={newSeller.email}
                    onChange={(e) => setNewSeller({ ...newSeller, email: e.target.value })}
                    placeholder="correo@empresa.com"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                  <input
                    type="password"
                    value={newSeller.password}
                    onChange={(e) => setNewSeller({ ...newSeller, password: e.target.value })}
                    placeholder="Contraseña (mín. 6 caracteres)"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                  <button
                    type="button"
                    disabled={testing}
                    onClick={async () => {
                      setTesting(true);
                      setStatusMsg("");
                      try {
                        const r = await fetch("/api/team", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(newSeller),
                        });
                        const d = await r.json();
                        if (r.ok) {
                          setNewSeller({ name: "", email: "", password: "" });
                          setStatusMsg(`✅ Vendedor "${d.member.name}" creado. Ya puede iniciar sesión en /login.`);
                          await loadTeam();
                        } else {
                          setStatusMsg(`❌ ${d.error}`);
                        }
                      } finally {
                        setTesting(false);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0070C0] hover:bg-[#005a9e] text-white text-xs font-bold rounded-xl"
                  >
                    <Plus className="w-4 h-4" /> Crear vendedor
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {teamMembers.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>{m.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          m.active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {m.active ? "ACTIVO" : "PAUSADO"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">{m.email} · Rol: Vendedor</div>
                  </div>
                  {canManageTeam && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await fetch("/api/team", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: m.id, active: !m.active }),
                          });
                          if (r.ok) {
                            setStatusMsg(
                              m.active ? `⏸️ Vendedor "${m.name}" pausado.` : `✅ Vendedor "${m.name}" reactivado.`
                            );
                            loadTeam();
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                      >
                        {m.active ? "Pausar acceso" : "Reactivar"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const np = prompt(`Nueva contraseña para ${m.name} (mínimo 6 caracteres):`);
                          if (!np || np.length < 6) return;
                          const r = await fetch("/api/team", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: m.id, newPassword: np }),
                          });
                          if (r.ok) setStatusMsg(`✅ Contraseña actualizada para ${m.name}.`);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-[#0070C0] rounded-lg"
                      >
                        <KeyRound className="w-3.5 h-3.5" /> Clave
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`¿Eliminar el acceso del vendedor "${m.name}" (${m.email})?`)) return;
                          const r = await fetch(`/api/team?id=${encodeURIComponent(m.id)}`, { method: "DELETE" });
                          if (r.ok) {
                            setStatusMsg(`🗑️ Vendedor "${m.name}" eliminado.`);
                            loadTeam();
                          }
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="Eliminar vendedor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {teamMembers.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  Aún no hay vendedores adicionales en esta empresa. Usa el formulario superior para crear accesos para tu equipo.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: SUPERADMIN SAAS COMPANIES CONTROL PANEL */}
        {tab === "admin" && userRole === "SUPERADMIN" && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#22115d] flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" /> Panel SuperAdmin · Compañías Registradas ({adminCompanies.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Control centralizado de todas las empresas en impulsa CRM: planes, conexiones activas, uso real y botón para suspender o reactivar accesos por suscripción.
                </p>
              </div>
              <button
                type="button"
                onClick={loadAdminCompanies}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar lista
              </button>
            </div>

            <div className="space-y-3">
              {adminCompanies.map((c) => (
                <div
                  key={c.id}
                  className={`p-4 rounded-2xl border space-y-3 ${
                    c.active
                      ? "bg-white border-slate-200"
                      : "bg-rose-50/60 border-rose-200"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-sm">{c.brandName}</span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            c.active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-600 text-white"
                          }`}
                        >
                          {c.active ? "● ACTIVA" : "⛔ SUSPENDIDA"}
                        </span>
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {c.id}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {c.companyName} · Dueño: <strong>{c.ownerEmail || "N/D"}</strong>
                        {c.phone ? ` · Tel: ${c.phone}` : ""}
                      </div>
                      {!c.active && c.suspendedReason && (
                        <div className="text-xs text-rose-700 font-semibold mt-1">
                          Motivo suspensión: {c.suspendedReason}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={c.plan}
                        onChange={async (e) => {
                          const plan = e.target.value;
                          const r = await fetch("/api/admin/companies", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: c.id, plan }),
                          });
                          if (r.ok) {
                            setStatusMsg(`✅ Plan de "${c.brandName}" actualizado a ${plan}.`);
                            loadAdminCompanies();
                          }
                        }}
                        className="px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <option value="BASICO">Plan BÁSICO</option>
                        <option value="PRO">Plan PRO</option>
                        <option value="ENTERPRISE">Plan ENTERPRISE</option>
                      </select>

                      <button
                        type="button"
                        onClick={async () => {
                          await fetch("/api/workspaces", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ workspaceId: c.id }),
                          });
                          window.location.reload();
                        }}
                        className="px-3 py-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-[#22115d] rounded-lg"
                      >
                        Entrar al espacio
                      </button>

                      {c.ownerUserId && c.ownerUserId !== "superadmin" && (
                        <button
                          type="button"
                          onClick={async () => {
                            const np = prompt(`Nueva contraseña para el dueño de "${c.brandName}" (${c.ownerEmail}):`);
                            if (!np || np.length < 6) return;
                            const r = await fetch("/api/admin/companies", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: c.id, resetOwnerPassword: np }),
                            });
                            if (r.ok) setStatusMsg(`✅ Contraseña restablecida para ${c.ownerEmail}.`);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-[#0070C0] rounded-lg"
                        >
                          <KeyRound className="w-3.5 h-3.5" /> Clave
                        </button>
                      )}

                      {c.id !== "default" && (
                        <button
                          type="button"
                          onClick={async () => {
                            const nextActive = !c.active;
                            let reason = "";
                            if (!nextActive) {
                              const input = prompt(
                                `Motivo de suspensión para "${c.brandName}" (opcional, ej. Mensualidad pendiente):`,
                                "Mensualidad pendiente"
                              );
                              if (input === null) return;
                              reason = input;
                            }
                            const r = await fetch("/api/admin/companies", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: c.id,
                                active: nextActive,
                                suspendedReason: nextActive ? "" : reason,
                              }),
                            });
                            if (r.ok) {
                              setStatusMsg(
                                nextActive
                                  ? `✅ Compañía "${c.brandName}" reactivada.`
                                  : `⛔ Compañía "${c.brandName}" suspendida.`
                              );
                              loadAdminCompanies();
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg ${
                            c.active
                              ? "bg-rose-600 hover:bg-rose-700 text-white"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" /> {c.active ? "Suspender" : "Activar"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] pt-2 border-t border-slate-100">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      👥 {c.stats.clientsCount} clientes
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      💬 {c.stats.conversationsCount} chats
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      📄 {c.stats.quotesCount} proformas
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      🧑‍💼 {c.stats.agentsCount} vendedores
                    </span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded font-bold ${c.connections.whatsapp ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"}`}>
                        WA
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold ${c.connections.social ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-400"}`}>
                        FB/IG
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold ${c.connections.email ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-400"}`}>
                        Mail
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold ${c.connections.ai ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-400"}`}>
                        IA
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab !== "backup" && tab !== "email" && tab !== "team" && tab !== "admin" && (
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-[#0070C0] hover:bg-[#005a9e] text-white rounded-xl shadow-sm"
            >
              {saving ? (
                "Guardando..."
              ) : (
                <>
                  <Save className="w-4 h-4" /> Guardar Configuración
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
