import { getCompanySettings, getIntegrationSettings, prisma } from "./prisma";
import { sendCorporateEmail } from "./email";
import { formatMoney } from "./format";
import { computeWorkspaceSlaStats } from "./round-robin";

export async function sendWeeklyExecutiveReport(opts: {
  workspaceId: string;
  toEmail?: string;
}) {
  const { workspaceId } = opts;
  const [company, cfg] = await Promise.all([
    getCompanySettings(workspaceId),
    getIntegrationSettings(workspaceId),
  ]);

  const targetEmail = (opts.toEmail || cfg.weeklyReportEmail || company.email || "").trim();
  if (!targetEmail) {
    return { ok: false, error: "Configura un correo destino para el Reporte Ejecutivo Semanal." };
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [newClients, wonQuotes, allQuotes, upcomingBookings, sla] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId, contactType: "CLIENTE", createdAt: { gte: since } },
      select: { source: true, stage: true, estimatedValue: true },
    }),
    prisma.quote.findMany({
      where: { workspaceId, status: "APROBADA", updatedAt: { gte: since } },
      select: { number: true, clientCompany: true, total: true, paidAmount: true, currency: true },
    }),
    prisma.quote.findMany({
      where: { workspaceId, status: { in: ["ENVIADA", "APROBADA"] } },
      select: { total: true, paidAmount: true },
    }),
    prisma.booking.count({
      where: { workspaceId, status: "CONFIRMADA", startsAt: { gte: new Date() } },
    }),
    computeWorkspaceSlaStats(workspaceId),
  ]);

  const currency = company.defaultCurrency || "CRC";
  const wonTotal = wonQuotes.reduce((s, q) => s + (q.total || 0), 0);
  const collectedTotal = wonQuotes.reduce((s, q) => s + (q.paidAmount || 0), 0);
  const pendingReceivables = allQuotes.reduce(
    (s, q) => s + Math.max(0, (q.total || 0) - (q.paidAmount || 0)),
    0
  );

  const bySource: Record<string, number> = {};
  for (const c of newClients) {
    bySource[c.source || "OTRO"] = (bySource[c.source || "OTRO"] || 0) + 1;
  }

  const sourceRows = Object.entries(bySource)
    .map(([src, cnt]) => `<li><strong>${src}:</strong> ${cnt} leads</li>`)
    .join("");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="background:${company.primaryColor || "#1e1046"};color:#fff;padding:24px;">
        <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#fde047;font-weight:700;">Reporte Ejecutivo Semanal · impulsa CRM</div>
        <h2 style="margin:6px 0 0;font-size:22px;">${company.brandName}</h2>
      </div>
      <div style="padding:24px;color:#1e293b;font-size:14px;line-height:1.55;">
        <p>Resumen automático de los últimos <strong>7 días</strong>:</p>
        <table style="width:100%;border-collapse:collapse;margin:14px 0;">
          <tr>
            <td style="padding:12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;">
              <div style="font-size:11px;color:#047857;font-weight:700;">PROFORMAS APROBADAS (7D)</div>
              <div style="font-size:20px;font-weight:900;color:#065f46;">${formatMoney(wonTotal, currency)} (${wonQuotes.length})</div>
            </td>
            <td style="width:12px;"></td>
            <td style="padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
              <div style="font-size:11px;color:#1d4ed8;font-weight:700;">ABONOS COBRADOS (7D)</div>
              <div style="font-size:20px;font-weight:900;color:#1e3a8a;">${formatMoney(collectedTotal, currency)}</div>
            </td>
          </tr>
        </table>
        <ul style="padding-left:18px;">
          <li><strong>Nuevos clientes esta semana:</strong> ${newClients.length}</li>
          <li><strong>Saldo pendiente por cobrar (proformas activas):</strong> ${formatMoney(pendingReceivables, currency)}</li>
          <li><strong>Citas confirmadas próximas:</strong> ${upcomingBookings}</li>
          <li><strong>Tiempo promedio de primera respuesta (SLA):</strong> ${
            sla.avgFirstResponseMinutes !== null ? `${sla.avgFirstResponseMinutes} min` : "Sin datos aún"
          }</li>
        </ul>
        ${sourceRows ? `<p><strong>Leads por canal:</strong></p><ul>${sourceRows}</ul>` : ""}
        <p style="font-size:12px;color:#64748b;margin-top:20px;">Enviado automáticamente por impulsa CRM.</p>
      </div>
    </div>
  `;

  const text = `Reporte Ejecutivo Semanal - ${company.brandName}\nProformas aprobadas (7d): ${formatMoney(wonTotal, currency)} (${wonQuotes.length})\nNuevos leads (7d): ${newClients.length}\nSaldo pendiente por cobrar: ${formatMoney(pendingReceivables, currency)}\nCitas próximas: ${upcomingBookings}\nSLA primera respuesta: ${sla.avgFirstResponseMinutes !== null ? `${sla.avgFirstResponseMinutes} min` : "N/A"}`;

  const mailRes = await sendCorporateEmail({
    workspaceId,
    to: targetEmail,
    subject: `📊 Reporte Ejecutivo Semanal · ${company.brandName}`,
    text,
    html,
  });

  return {
    ok: mailRes.ok,
    simulated: mailRes.simulated,
    message: mailRes.simulated
      ? `Reporte preparado para ${targetEmail} (configura SMTP para envío real).`
      : `📊 Reporte Ejecutivo Semanal enviado a ${targetEmail}.`,
  };
}
