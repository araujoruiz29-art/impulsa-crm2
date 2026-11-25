"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("ventas@elcaminantecr.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Credenciales inválidas.");
      } else {
        const nextPath = searchParams.get("next") || "/";
        router.push(nextPath.startsWith("/") ? nextPath : "/");
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
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-xl p-8 space-y-6">
        {/* Exact Impulsa CRM Logo */}
        <div className="flex flex-col items-center justify-center gap-1.5">
          <img
            src="/brand/impulsa-symbol.svg"
            alt="impulsa CRM"
            width={72}
            height={72}
            className="w-[72px] h-[72px] object-contain"
          />
          <span className="flex flex-col items-center font-bold text-[30px] leading-[1.08] tracking-[-1px] text-[#22115d]">
            impulsa
            <small className="text-[10px] font-semibold tracking-[4px] leading-none text-[#22115d] mt-1.5 ml-1 uppercase">
              CRM
            </small>
          </span>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Acceso privado · Plataforma Multiempresa
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Correo de acceso
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ventas@elcaminantecr.com"
                className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#22115d]/20"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
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
            {loading ? "Verificando..." : "Entrar al CRM"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Sesión protegida · Webhooks de Meta activos 24/7
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Cargando acceso...</div>}>
      <LoginFormInner />
    </Suspense>
  );
}
