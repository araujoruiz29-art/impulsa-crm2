"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, ArrowRight, ShieldCheck, Building2, User } from "lucide-react";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("CRC");
  const [defaultTaxMode, setDefaultTaxMode] = useState("IVA_INCLUIDO");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        mode === "register"
          ? { name, email, password, brandName, defaultCurrency, defaultTaxMode }
          : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo completar el acceso.");
      } else {
        const nextPath = searchParams.get("next") || "/";
        router.push(mode === "register" ? "/" : nextPath.startsWith("/") ? nextPath : "/");
        router.refresh();
      }
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F7F8FC] via-[#EEF1FA] to-[#E9E4F8] p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-xl p-8 space-y-5">
        {/* Exact Impulsa CRM Logo */}
        <div className="flex flex-col items-center justify-center gap-1.5">
          <img
            src="/brand/impulsa-symbol.svg"
            alt="impulsa CRM"
            width={68}
            height={68}
            className="w-[68px] h-[68px] object-contain"
          />
          <span className="flex flex-col items-center font-bold text-[28px] leading-[1.08] tracking-[-1px] text-[#22115d]">
            impulsa
            <small className="text-[10px] font-semibold tracking-[4px] leading-none text-[#22115d] mt-1.5 ml-1 uppercase">
              CRM
            </small>
          </span>
          <p className="text-xs text-slate-500 mt-1 text-center">
            Plataforma Multiempresa · Espacio 100% privado por compañía
          </p>
        </div>

        {/* Mode Switch Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`py-2 rounded-xl transition ${
              mode === "login"
                ? "bg-white text-[#22115d] shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`py-2 rounded-xl transition ${
              mode === "register"
                ? "bg-white text-[#22115d] shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Crear nueva empresa
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "register" && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Nombre de tu empresa *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Ej. Distribuidora Norte S.A."
                    className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#22115d]/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Tu nombre completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Carlos Ramírez"
                    className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#22115d]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Moneda</label>
                  <select
                    value={defaultCurrency}
                    onChange={(e) => setDefaultCurrency(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="CRC">₡ Colones (CRC)</option>
                    <option value="USD">$ Dólares (USD)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Impuesto</label>
                  <select
                    value={defaultTaxMode}
                    onChange={(e) => setDefaultTaxMode(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="IVA_INCLUIDO">IVA 13% Incluido</option>
                    <option value="DESGLOSADO">IVA 13% Desglosado</option>
                    <option value="EXONERADO">Exonerado (0%)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Correo electrónico *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@tuempresa.com"
                className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#22115d]/20"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Contraseña {mode === "register" ? "(mín. 6 caracteres) *" : "*"}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={mode === "register" ? 6 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#22115d]/20"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#22115d] hover:bg-[#2d1878] text-white font-bold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-60"
          >
            {loading
              ? mode === "register"
                ? "Creando tu espacio..."
                : "Verificando..."
              : mode === "register"
              ? "Crear cuenta y entrar al CRM"
              : "Entrar al CRM"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          Cada empresa cuenta con datos, proformas, WhatsApp e IA 100% privados
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-500">
          Cargando acceso...
        </div>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}
