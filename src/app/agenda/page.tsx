"use client";

import React, { useEffect, useState } from "react";
import { Calendar, CheckCircle2, Circle, Plus, BarChart3, PhoneCall } from "lucide-react";
import { formatDateCR, formatMoney } from "@/lib/format";

interface TaskItem {
  id: string;
  type: string;
  title: string;
  description: string;
  dueDate: string | null;
  completed: boolean;
  client?: { id: string; company: string } | null;
}

interface ClientSimple {
  id: string;
  company: string;
  assignedTo: string;
  source: string;
  stage: string;
  estimatedValue: number;
}

export default function AgendaReportesPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [clients, setClients] = useState<ClientSimple[]>([]);
  const [newTask, setNewTask] = useState({
    clientId: "",
    type: "TAREA",
    title: "",
    description: "",
    dueDate: new Date().toISOString().slice(0, 16),
  });

  const load = async () => {
    const [dRes, cRes] = await Promise.all([fetch("/api/dashboard"), fetch("/api/clients")]);
    const [dData, cData] = await Promise.all([dRes.json(), cRes.json()]);
    setTasks(dData.pendingTasks || []);
    setClients(cData.clients || []);
  };

  useEffect(() => {
    load();
  }, []);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newTask,
        clientId: newTask.clientId || null,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString() : null,
      }),
    });
    setNewTask({ ...newTask, title: "", description: "" });
    load();
  };

  const toggleTask = async (id: string, completed: boolean) => {
    await fetch("/api/activities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed: !completed }),
    });
    load();
  };

  // Report aggregations by Seller & by Channel/Source
  const bySeller = clients.reduce<Record<string, { count: number; value: number; won: number }>>((acc, c) => {
    const key = c.assignedTo || "Sin asignar";
    if (!acc[key]) acc[key] = { count: 0, value: 0, won: 0 };
    acc[key].count++;
    acc[key].value += c.estimatedValue || 0;
    if (c.stage === "GANADO") acc[key].won++;
    return acc;
  }, {});

  const bySource = clients.reduce<Record<string, { count: number; value: number }>>((acc, c) => {
    const key = c.source || "MANUAL";
    if (!acc[key]) acc[key] = { count: 0, value: 0 };
    acc[key].count++;
    acc[key].value += c.estimatedValue || 0;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Agenda, Llamadas y Reportes</h1>
        <p className="text-sm text-slate-500">
          Seguimientos programados, citas con clientes y desempeño por vendedor, canal y origen.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* New Task / Call / Appointment */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-[#0070C0]" />
            Programar Cita, Llamada o Seguimiento
          </h2>
          <form onSubmit={createTask} className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-semibold text-slate-600">Tipo</label>
              <select
                value={newTask.type}
                onChange={(e) => setNewTask({ ...newTask, type: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
              >
                <option value="TAREA">Tarea / Seguimiento</option>
                <option value="LLAMADA">Llamada Comercial</option>
                <option value="WHATSAPP">Seguimiento WhatsApp</option>
                <option value="CORREO">Enviar Correo</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Cliente</label>
              <select
                value={newTask.clientId}
                onChange={(e) => setNewTask({ ...newTask, clientId: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl bg-white"
              >
                <option value="">-- General --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.company}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Título *</label>
              <input
                required
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Ej. Llamar para confirmar tallas de uniformes"
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Fecha y hora</label>
              <input
                type="datetime-local"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Notas</label>
              <textarea
                rows={2}
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-[#0070C0] hover:bg-[#005a9e] text-white font-semibold rounded-xl flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Agendar Actividad
            </button>
          </form>
        </div>

        {/* Pending schedule list */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-emerald-600" />
            Agenda de Seguimientos y Citas Pendientes ({tasks.length})
          </h2>
          <div className="space-y-2.5">
            {tasks.map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/70"
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleTask(t.id, t.completed)}
                    className="mt-0.5 text-slate-400 hover:text-emerald-600"
                  >
                    {t.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Circle className="w-5 h-5" />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-[#0070C0]">
                        {t.type}
                      </span>
                      <span className="font-semibold text-sm text-slate-900">{t.title}</span>
                    </div>
                    {t.client && (
                      <div className="text-xs font-medium text-[#0070C0] mt-0.5">{t.client.company}</div>
                    )}
                    {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                  </div>
                </div>
                {t.dueDate && (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg shrink-0">
                    {formatDateCR(t.dueDate)}
                  </span>
                )}
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="text-sm text-slate-400 text-center py-10">
                No tienes citas o tareas pendientes.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reports by Seller & by Channel/Source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#0070C0]" />
            Reporte por Vendedor / Responsable
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="pb-2">Vendedor</th>
                <th className="pb-2 text-center">Clientes</th>
                <th className="pb-2 text-center">Ganados</th>
                <th className="pb-2 text-right">Cartera (₡)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(bySeller).map(([seller, stats]) => (
                <tr key={seller}>
                  <td className="py-2.5 font-semibold text-slate-800">{seller}</td>
                  <td className="py-2.5 text-center">{stats.count}</td>
                  <td className="py-2.5 text-center text-emerald-700 font-semibold">{stats.won}</td>
                  <td className="py-2.5 text-right font-bold text-slate-900">{formatMoney(stats.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            Reporte por Canal y Origen (Meta, WhatsApp, Correo)
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="pb-2">Canal / Origen</th>
                <th className="pb-2 text-center">Leads</th>
                <th className="pb-2 text-right">Valor Estimado (₡)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(bySource).map(([src, stats]) => (
                <tr key={src}>
                  <td className="py-2.5 font-semibold text-slate-800">{src}</td>
                  <td className="py-2.5 text-center">{stats.count}</td>
                  <td className="py-2.5 text-right font-bold text-[#0070C0]">{formatMoney(stats.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
