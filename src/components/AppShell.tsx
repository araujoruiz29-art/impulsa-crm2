"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Kanban,
  FileText,
  Package,
  MessageSquare,
  Bot,
  Settings,
  Menu,
  X,
  PlusCircle,
  Calendar,
  BellRing,
  BookOpen,
  Search,
  ChevronDown,
  Building2,
  Check,
  Plus,
  LogOut,
  FileQuestion,
  Megaphone,
} from "lucide-react";

interface WorkspaceSummary {
  id: string;
  brandName: string;
  companyName: string;
  primaryColor: string;
  accentColor: string;
  logoPath: string;
  defaultCurrency: string;
  defaultTaxMode: string;
  defaultSeller: string;
  clientsCount: number;
  quotesCount: number;
}

const NAV_GROUPS = [
  {
    title: "TU ESPACIO",
    items: [
      { href: "/", label: "Resumen", icon: LayoutDashboard },
      { href: "/bandeja", label: "Conversaciones", icon: MessageSquare, badgeKey: "unread" as const },
      { href: "/avisos", label: "Avisos al vendedor", icon: BellRing, badgeKey: "alerts" as const },
      { href: "/embudo", label: "Ventas · Kanban", icon: Kanban },
      { href: "/clientes", label: "Contactos", icon: Users },
      { href: "/agenda", label: "Agenda y reportes", icon: Calendar },
    ],
  },
  {
    title: "CATÁLOGO Y PROFORMAS",
    items: [
      { href: "/cotizaciones", label: "Cotizaciones PDF", icon: FileText },
      { href: "/catalogo", label: "Catálogo e inventario", icon: Package },
    ],
  },
  {
    title: "IA Y SISTEMA",
    items: [
      { href: "/conocimiento", label: "Conocimiento y docs", icon: BookOpen },
      { href: "/campanas", label: "Campañas y Ciclo 1-7-90", icon: Megaphone },
      { href: "/automatizaciones", label: "Agente IA y reglas", icon: Bot },
      { href: "/configuracion", label: "Conexiones y empresa", icon: Settings },
      { href: "/manual", label: "Manual de uso", icon: FileQuestion },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const COLOR_PRESETS = [
  { name: "Índigo Impulsa", value: "#1E1046" },
  { name: "Azul Caminante", value: "#0070C0" },
  { name: "Esmeralda", value: "#065F46" },
  { name: "Borgoña", value: "#881337" },
  { name: "Grafito", value: "#0F172A" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [newWsOpen, setNewWsOpen] = useState(false);
  const [creatingWs, setCreatingWs] = useState(false);

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWsId, setActiveWsId] = useState("default");

  const [newWsForm, setNewWsForm] = useState({
    brandName: "",
    companyName: "",
    primaryColor: "#1E1046",
    accentColor: "#0070C0",
    defaultCurrency: "CRC",
    defaultTaxMode: "IVA_INCLUIDO",
    defaultSeller: "Jelsing R.",
  });

  const [status, setStatus] = useState({
    alerts: 0,
    unread: 0,
    whatsappConnected: false,
    emailConnected: false,
    aiConnected: false,
  });

  const loadShellData = async () => {
    try {
      const [wsRes, dashRes] = await Promise.all([
        fetch("/api/workspaces"),
        fetch("/api/dashboard"),
      ]);
      if (wsRes.status === 401 || dashRes.status === 401) {
        window.location.href = "/login";
        return;
      }
      const [wsData, dashData] = await Promise.all([wsRes.json(), dashRes.json()]);
      if (wsData?.workspaces) {
        setWorkspaces(wsData.workspaces);
        setActiveWsId(wsData.activeWorkspaceId || "default");
        const active = wsData.workspaces.find(
          (w: WorkspaceSummary) => w.id === (wsData.activeWorkspaceId || "default")
        );
        if (active && typeof document !== "undefined") {
          document.documentElement.style.setProperty("--brand-primary", active.primaryColor || "#1E1046");
          document.documentElement.style.setProperty("--brand-accent", active.accentColor || "#0070C0");
        }
      }
      if (dashData?.kpis) {
        setStatus({
          alerts: dashData.kpis.openAlertsCount || 0,
          unread: dashData.kpis.unreadMessages || 0,
          whatsappConnected: Boolean(dashData.connections?.whatsappConnected),
          emailConnected: Boolean(dashData.connections?.emailConnected),
          aiConnected: Boolean(dashData.connections?.aiConnected),
        });
      }
    } catch {
      // Ignore transient load error
    }
  };

  useEffect(() => {
    if (pathname === "/login") return;
    loadShellData();
  }, [pathname]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const activeWs = workspaces.find((w) => w.id === activeWsId) || workspaces[0];
  const currentNav =
    ALL_ITEMS.find((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href))) ||
    ALL_ITEMS[0];

  const switchWorkspace = async (workspaceId: string) => {
    setSwitcherOpen(false);
    if (workspaceId === activeWsId) return;
    await fetch("/api/workspaces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    window.location.reload();
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsForm.brandName.trim()) return;
    setCreatingWs(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWsForm),
      });
      if (res.ok) {
        setNewWsOpen(false);
        window.location.reload();
      }
    } finally {
      setCreatingWs(false);
    }
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    router.push(`/clientes`);
  };

  const initials = (activeWs?.defaultSeller || "JR")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-[#F7F8FC] text-slate-900">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Left Sidebar (Impulsa clean white layout) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200/90 flex flex-col transition-transform lg:translate-x-0 lg:static ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Exact Impulsa CRM Brand Header */}
        <div className="px-4 pt-5 pb-4 border-b border-slate-100 relative flex items-center justify-center">
          <Link
            href="/"
            className="flex flex-col items-center justify-center gap-1 text-[#22115d] select-none"
            onClick={() => setMobileOpen(false)}
            aria-label="impulsa CRM"
          >
            <img
              src="/brand/impulsa-symbol.svg"
              alt=""
              width={52}
              height={52}
              className="w-[52px] h-[52px] object-contain block"
            />
            <span className="flex flex-col items-center font-bold text-[26px] leading-[1.08] tracking-[-0.9px] text-[#22115d]">
              impulsa
              <small className="text-[9px] font-semibold tracking-[4px] leading-none text-[#22115d] mt-1.5 ml-1 uppercase">
                CRM
              </small>
            </span>
          </Link>
          <button
            className="lg:hidden absolute right-3 top-3 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Search */}
        <div className="px-3.5 pt-3 pb-1">
          <form onSubmit={handleGlobalSearch} className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Buscar contacto o proforma..."
              className="w-full pl-8 pr-2.5 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-900/15"
            />
          </form>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const badgeCount =
                    "badgeKey" in item && item.badgeKey === "alerts"
                      ? status.alerts
                      : "badgeKey" in item && item.badgeKey === "unread"
                      ? status.unread
                      : 0;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      style={
                        active
                          ? {
                              backgroundColor: "var(--brand-soft)",
                              color: "var(--brand-primary)",
                            }
                          : undefined
                      }
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[13px] transition ${
                        active
                          ? "font-bold"
                          : "text-slate-600 font-medium hover:bg-slate-100/80 hover:text-slate-900"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className="w-4 h-4 shrink-0"
                          style={
                            active
                              ? { color: "var(--brand-primary)" }
                              : "badgeKey" in item && item.badgeKey === "alerts" && badgeCount > 0
                              ? { color: "#e11d48" }
                              : { color: "#94a3b8" }
                          }
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {badgeCount > 0 && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            "badgeKey" in item && item.badgeKey === "alerts"
                              ? "bg-rose-600 text-white"
                              : "bg-indigo-900 text-white"
                          }`}
                        >
                          {badgeCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: Connection Status + User Profile (Impulsa style) */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 space-y-2.5">
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold">
              BD Local
            </span>
            <Link
              href="/configuracion"
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                status.whatsappConnected
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              WA {status.whatsappConnected ? "Activo" : "Local"}
            </Link>
            <Link
              href="/configuracion"
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                status.emailConnected
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              Mail {status.emailConnected ? "Activo" : "Local"}
            </Link>
            <Link
              href="/configuracion"
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                status.aiConnected
                  ? "bg-purple-100 text-purple-800"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              IA {status.aiConnected ? "API" : "Local"}
            </Link>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate">
                  {activeWs?.defaultSeller || "Jelsing R."}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {activeWs?.defaultCurrency === "USD" ? "$ USD" : "₡ Colones · IVA 13%"}
                </div>
              </div>
            </div>
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area with Impulsa Top Header Bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200/90 px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          {/* Left: Mobile Menu + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
              <span className="hidden sm:inline font-medium">Espacio de trabajo</span>
              <span className="hidden sm:inline">/</span>
              <span className="font-bold text-slate-800 text-sm truncate">
                {currentNav?.label || "Resumen"}
              </span>
            </div>
          </div>

          {/* Right: Multi-company Workspace Switcher + Primary CTA */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Workspace Switcher Dropdown (Impulsa signature) */}
            <div className="relative">
              <button
                onClick={() => setSwitcherOpen(!switcherOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-xs font-semibold text-slate-800 transition shadow-2xs"
              >
                {activeWs?.logoPath ? (
                  <img
                    src={activeWs.logoPath}
                    alt={activeWs.brandName}
                    className="h-4 w-auto max-w-[68px] object-contain shrink-0"
                  />
                ) : (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: activeWs?.primaryColor || "#1E1046" }}
                  />
                )}
                <span className="max-w-[140px] sm:max-w-[190px] truncate">
                  {activeWs?.brandName || "Caminante Corporativo"}
                </span>
                <span className="hidden md:inline text-[11px] font-normal text-slate-400">
                  · {activeWs?.clientsCount ?? 0} contactos
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {switcherOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setSwitcherOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl z-40 p-2 space-y-1">
                    <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Empresas ({workspaces.length})
                    </div>
                    {workspaces.map((ws) => {
                      const isCurrent = ws.id === activeWsId;
                      return (
                        <button
                          key={ws.id}
                          onClick={() => switchWorkspace(ws.id)}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left transition ${
                            isCurrent ? "bg-slate-100" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ backgroundColor: ws.primaryColor || "#1E1046" }}
                            >
                              {ws.brandName.slice(0, 2).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {ws.brandName}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {ws.clientsCount} contactos · {ws.quotesCount} proformas
                              </div>
                            </div>
                          </div>
                          {isCurrent && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                        </button>
                      );
                    })}
                    <div className="pt-1 mt-1 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setSwitcherOpen(false);
                          setNewWsOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-indigo-900 hover:bg-indigo-50 transition"
                      >
                        <Plus className="w-4 h-4" />
                        Crear nueva empresa
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-7 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Modal: Create New Company Workspace */}
      {newWsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-900" />
                Crear Nueva Empresa (Multiempresa)
              </h2>
              <button onClick={() => setNewWsOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Cada empresa tiene sus propios clientes, catálogo, proformas PDF, bandeja, Agente IA, logo y color de marca independientes.
            </p>
            <form onSubmit={handleCreateWorkspace} className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-600">Nombre comercial *</label>
                <input
                  required
                  value={newWsForm.brandName}
                  onChange={(e) => setNewWsForm({ ...newWsForm, brandName: e.target.value })}
                  placeholder="Ej. Estudio Norte, Bordados Express..."
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Razón social</label>
                <input
                  value={newWsForm.companyName}
                  onChange={(e) => setNewWsForm({ ...newWsForm, companyName: e.target.value })}
                  placeholder="Opcional (para Factura Proforma)"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Moneda</label>
                  <select
                    value={newWsForm.defaultCurrency}
                    onChange={(e) => setNewWsForm({ ...newWsForm, defaultCurrency: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="CRC">₡ Colones (CRC)</option>
                    <option value="USD">$ Dólares (USD)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Impuesto</label>
                  <select
                    value={newWsForm.defaultTaxMode}
                    onChange={(e) => setNewWsForm({ ...newWsForm, defaultTaxMode: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="IVA_INCLUIDO">IVA 13% Incluido</option>
                    <option value="DESGLOSADO">IVA 13% Desglosado</option>
                    <option value="EXONERADO">Exonerado (0%)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  Color principal de marca
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((cp) => (
                    <button
                      type="button"
                      key={cp.value}
                      onClick={() => setNewWsForm({ ...newWsForm, primaryColor: cp.value })}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                        newWsForm.primaryColor === cp.value
                          ? "border-slate-900 bg-slate-50 font-bold"
                          : "border-slate-200"
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cp.value }} />
                      {cp.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewWsOpen(false)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingWs}
                  className="btn-brand px-5 py-2 text-xs font-bold rounded-xl"
                >
                  {creatingWs ? "Creando..." : "Crear y cambiar a empresa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
