import fs from "fs";
import path from "path";
import { DAILY_ROUTINE, MANUAL_SECTIONS } from "../src/lib/manual-content";
import {
  CONNECTION_GUIDES,
  QUICK_PORTAL_LINKS,
  TROUBLESHOOTING_ROWS,
} from "../src/lib/connections-manual-content";

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const rootDir = process.cwd();
const svgPath = path.join(rootDir, "public", "brand", "impulsa-symbol.svg");
const svgMarkup = fs.existsSync(svgPath) ? fs.readFileSync(svgPath, "utf8").trim() : "";

const sectionsHtml = MANUAL_SECTIONS.map((sec) => {
  const tipHtml = sec.tip
    ? `      <div class="tip"><strong>Consejo práctico:</strong> ${esc(sec.tip)}</div>`
    : "";
  const rowsHtml = sec.buttons
    .map(
      (b) => `          <tr>
            <td class="ctrl">${esc(b.control)}</td>
            <td class="loc">${esc(b.location)}</td>
            <td>${esc(b.purpose)}</td>
          </tr>`
    )
    .join("\n");

  return `  <section class="section">
    <div class="sec-head">
      <div class="sec-title-wrap">
        <span class="num">${esc(sec.number)}</span>
        <div>
          <div class="group">${esc(sec.group)}</div>
          <h2>${esc(sec.title)}</h2>
        </div>
      </div>
      <span class="route">${esc(sec.route)}</span>
    </div>
    <div class="sec-body">
      <p class="summary">${esc(sec.summary)}</p>
${tipHtml}
      <table>
        <thead>
          <tr>
            <th style="width:28%">Botón / Control</th>
            <th style="width:22%">Ubicación</th>
            <th>Para qué funciona</th>
          </tr>
        </thead>
        <tbody>
${rowsHtml}
        </tbody>
      </table>
    </div>
  </section>`;
}).join("\n");

const routineHtml = DAILY_ROUTINE.map(
  (r) => `  <div class="routine-card">
    <div class="routine-step">${esc(r.step)}</div>
    <p>${esc(r.detail)}</p>
  </div>`
).join("\n\n");

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Manual de Uso · impulsa CRM (Caminante Corporativo)</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Roboto, Arial, sans-serif;
    color: #0f172a;
    background: #f8fafc;
    margin: 0;
    padding: 24px;
    line-height: 1.45;
  }
  .toolbar {
    max-width: 960px;
    margin: 0 auto 18px auto;
    background: #22115d;
    color: #fff;
    padding: 14px 20px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .toolbar button {
    background: #ffffff;
    color: #22115d;
    border: none;
    padding: 10px 18px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
  }
  .page {
    max-width: 960px;
    margin: 0 auto;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    padding: 36px 40px;
  }
  .cover {
    border-bottom: 3px solid #22115d;
    padding-bottom: 18px;
    margin-bottom: 22px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .brand svg { width: 56px; height: 56px; flex-shrink: 0; }
  .eyebrow {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.16em;
    color: #0070C0;
    text-transform: uppercase;
  }
  h1 {
    margin: 2px 0 4px 0;
    font-size: 24px;
    color: #22115d;
  }
  .sub { font-size: 12px; color: #64748b; margin: 0; }
  .meta-box {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    padding: 10px 14px;
    font-size: 11.5px;
    line-height: 1.6;
  }
  .meta-box strong { color: #1e293b; }
  .section {
    border: 1px solid #cbd5e1;
    border-radius: 14px;
    margin-bottom: 20px;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .sec-head {
    background: #f1f5f9;
    border-bottom: 1px solid #cbd5e1;
    padding: 11px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .sec-title-wrap { display: flex; align-items: center; gap: 11px; }
  .num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: #22115d;
    color: #fff;
    font-weight: 800;
    font-size: 12px;
    flex-shrink: 0;
  }
  .group { font-size: 9.5px; font-weight: 700; color: #64748b; letter-spacing: 0.08em; }
  h2 { margin: 1px 0 0 0; font-size: 15px; color: #0f172a; }
  .route {
    font-family: Consolas, monospace;
    font-size: 11px;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    padding: 3px 8px;
    color: #475569;
  }
  .sec-body { padding: 14px 16px; }
  .summary { margin: 0 0 10px 0; font-size: 12.5px; color: #334155; }
  .tip {
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    color: #0c4a6e;
    border-radius: 10px;
    padding: 9px 12px;
    font-size: 11.5px;
    margin-bottom: 12px;
  }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th {
    background: #f8fafc;
    text-align: left;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #475569;
    padding: 7px 9px;
    border: 1px solid #cbd5e1;
  }
  td {
    padding: 7px 9px;
    border: 1px solid #cbd5e1;
    vertical-align: top;
    color: #334155;
  }
  tbody tr:nth-child(even) { background: #f8fafc; }
  td.ctrl { font-weight: 700; color: #22115d; }
  td.loc { color: #64748b; }
  .routine {
    border: 2px solid #86efac;
    background: #f0fdf4;
    border-radius: 14px;
    padding: 16px 18px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .routine h2 { color: #14532d; margin-bottom: 10px; }
  .routine-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .routine-card {
    background: #fff;
    border: 1px solid #bbf7d0;
    border-radius: 10px;
    padding: 10px 12px;
  }
  .routine-step { font-size: 12px; font-weight: 800; color: #14532d; margin-bottom: 4px; }
  .routine-card p { margin: 0; font-size: 11.5px; color: #334155; }
  footer {
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    font-size: 10.5px;
    color: #64748b;
  }
  @media print {
    @page { size: letter; margin: 12mm 14mm; }
    body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toolbar { display: none !important; }
    .page { border: none; padding: 0; max-width: 100%; border-radius: 0; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <div><strong>Manual de Uso · impulsa CRM (Caminante Corporativo)</strong> — Listo para imprimir o guardar en PDF</div>
    <button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  </div>
  <div class="page">
    <div class="cover">
      <div class="brand">
        ${svgMarkup}
        <div>
          <div class="eyebrow">Manual Operativo de Usuario</div>
          <h1>impulsa CRM · Plataforma Multiempresa</h1>
          <p class="sub">Guía completa de operación: ventas, proformas PDF, bandeja omnicanal, campañas, catálogo y Agente IA</p>
        </div>
      </div>
      <div class="meta-box">
        <div><strong>Acceso Web 24/7:</strong> https://impulsa-crm2.vercel.app</div>
        <div><strong>Registro nueva empresa:</strong> /login?mode=register</div>
        <div><strong>Manual en línea:</strong> /manual</div>
      </div>
    </div>

${sectionsHtml}

    <div class="routine">
      <h2>13. Rutina Diaria Recomendada para el Equipo de Ventas</h2>
      <div class="routine-grid">
${routineHtml}
      </div>
    </div>
    <footer>
      <span>Manual de Uso Oficial · impulsa CRM · Caminante Corporativo</span>
      <span>https://impulsa-crm2.vercel.app/manual</span>
    </footer>
  </div>
</body>
</html>
`;

const outPath = path.join(rootDir, "Manual-de-Uso-Impulsa-CRM.html");
fs.writeFileSync(outPath, html, "utf8");
console.log(`Updated ${outPath} (${MANUAL_SECTIONS.length} sections, ${html.length} bytes)`);

// Also regenerate Manual-Conexiones-Impulsa-CRM.html
const linksRows = QUICK_PORTAL_LINKS.map(
  (l) => `<tr><td class="ctrl">${esc(l.label)}</td><td><a href="${esc(l.url)}" target="_blank">${esc(l.url)}</a></td><td>${esc(l.note)}</td></tr>`
).join("\n");

const guidesHtml = CONNECTION_GUIDES.map((g) => {
  const reqs = g.prerequisites.map((r) => `<li>${esc(r)}</li>`).join("");
  const steps = g.steps
    .map(
      (st, idx) => `<div style="border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;margin-bottom:8px;break-inside:avoid;">
        <div style="font-weight:800;color:#22115d;margin-bottom:4px;">Paso ${idx + 1}. ${esc(st.title)}${
          st.link ? ` — <a href="${esc(st.link.url)}" target="_blank" style="color:#0070C0;">${esc(st.link.label)}</a>` : ""
        }</div>
        <ul style="margin:4px 0 0 18px;padding:0;font-size:11.5px;color:#334155;">${st.details
          .map((d) => `<li>${esc(d)}</li>`)
          .join("")}</ul>
      </div>`
    )
    .join("\n");
  const fields = g.crmFields
    .map((f) => `<tr><td class="ctrl">${esc(f.field)}</td><td>${esc(f.whereToFind)}</td></tr>`)
    .join("");
  const warn = g.warning
    ? `<div class="tip" style="background:#fffbeb;border-color:#fcd34d;color:#78350f;margin-top:8px;"><strong>Nota importante:</strong> ${esc(g.warning)}</div>`
    : "";
  return `<section class="section">
    <div class="sec-head">
      <div class="sec-title-wrap"><span class="num" style="background:#0070C0;">${esc(g.number)}</span><div><div class="group">${esc(g.badge)}</div><h2>${esc(g.title)}</h2></div></div>
    </div>
    <div class="sec-body">
      <p class="summary">${esc(g.subtitle)}</p>
      <div class="tip"><strong>Requisitos previos:</strong><ul style="margin:4px 0 0 18px;padding:0;">${reqs}</ul></div>
      ${steps}
      <table><thead><tr><th style="width:35%">Campo en el CRM</th><th>Dónde obtener el valor</th></tr></thead><tbody>${fields}</tbody></table>
      ${warn}
    </div>
  </section>`;
}).join("\n");

const troubleRows = TROUBLESHOOTING_ROWS.map(
  (r) => `<tr><td class="ctrl" style="color:#9f1239;">${esc(r.error)}</td><td class="loc">${esc(r.cause)}</td><td>${esc(r.fix)}</td></tr>`
).join("\n");

const connHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Manual Interno de Conexiones · impulsa CRM</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; background: #f8fafc; margin: 0; padding: 24px; line-height: 1.45; }
  .toolbar { max-width: 960px; margin: 0 auto 18px auto; background: #0070C0; color: #fff; padding: 14px 20px; border-radius: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .toolbar button { background: #fff; color: #0070C0; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; }
  .page { max-width: 960px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 36px 40px; }
  .cover { border-bottom: 3px solid #0070C0; padding-bottom: 18px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand svg { width: 56px; height: 56px; flex-shrink: 0; }
  .eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.16em; color: #0070C0; text-transform: uppercase; }
  h1 { margin: 2px 0 4px 0; font-size: 24px; color: #22115d; }
  .sub { font-size: 12px; color: #64748b; margin: 0; }
  .meta-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 10px 14px; font-size: 11.5px; line-height: 1.6; }
  .section { border: 1px solid #cbd5e1; border-radius: 14px; margin-bottom: 20px; overflow: hidden; }
  .sec-head { background: #f1f5f9; border-bottom: 1px solid #cbd5e1; padding: 11px 16px; display: flex; justify-content: space-between; align-items: center; }
  .sec-title-wrap { display: flex; align-items: center; gap: 11px; }
  .num { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; color: #fff; font-weight: 800; font-size: 12px; flex-shrink: 0; }
  .group { font-size: 9.5px; font-weight: 700; color: #0070C0; letter-spacing: 0.08em; }
  h2 { margin: 1px 0 0 0; font-size: 15px; color: #0f172a; }
  .sec-body { padding: 14px 16px; }
  .summary { margin: 0 0 10px 0; font-size: 12.5px; color: #334155; }
  .tip { background: #f0f9ff; border: 1px solid #bae6fd; color: #0c4a6e; border-radius: 10px; padding: 9px 12px; font-size: 11.5px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-top: 8px; }
  th { background: #f8fafc; text-align: left; font-size: 10.5px; text-transform: uppercase; color: #475569; padding: 7px 9px; border: 1px solid #cbd5e1; }
  td { padding: 7px 9px; border: 1px solid #cbd5e1; vertical-align: top; color: #334155; }
  td.ctrl { font-weight: 700; color: #22115d; }
  td.loc { color: #64748b; }
  a { color: #0070C0; word-break: break-all; }
  footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10.5px; color: #64748b; }
  @media print { @page { size: letter; margin: 12mm 14mm; } body { background: #fff; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .toolbar { display: none !important; } .page { border: none; padding: 0; max-width: 100%; } }
</style>
</head>
<body>
  <div class="toolbar">
    <div><strong>Manual Interno de Conexiones · impulsa CRM</strong> — Meta, WhatsApp, IG, Messenger, Meta Ads, Correos e IA</div>
    <button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  </div>
  <div class="page">
    <div class="cover">
      <div class="brand">${svgMarkup}<div><div class="eyebrow">Manual Técnico Interno · Integraciones</div><h1>Guía de Conexiones · impulsa CRM</h1><p class="sub">Paso a paso oficial para conectar WhatsApp, Messenger, Instagram, Comentarios, Meta Ads, Correos y Gemini IA</p></div></div>
      <div class="meta-box"><strong>Webhook Universal 24/7:</strong><br/>https://impulsa-crm2.vercel.app/api/webhooks/meta</div>
    </div>
    <section class="section"><div class="sec-head"><div class="sec-title-wrap"><h2>Directorio Oficial de Enlaces Directos</h2></div></div><div class="sec-body"><table><thead><tr><th style="width:28%">Portal</th><th style="width:40%">Enlace directo</th><th>Uso</th></tr></thead><tbody>${linksRows}</tbody></table></div></section>
    ${guidesHtml}
    <section class="section"><div class="sec-head" style="background:#fffbeb;"><div class="sec-title-wrap"><h2>🛠️ Solución Rápida de Errores Frecuentes</h2></div></div><div class="sec-body"><table><thead><tr><th style="width:30%">Problema</th><th style="width:28%">Causa</th><th>Solución</th></tr></thead><tbody>${troubleRows}</tbody></table></div></section>
    <footer><span>Manual Interno de Conexiones · impulsa CRM</span><span>https://impulsa-crm2.vercel.app/manual</span></footer>
  </div>
</body>
</html>`;

const connOut = path.join(rootDir, "Manual-Conexiones-Impulsa-CRM.html");
fs.writeFileSync(connOut, connHtml, "utf8");
console.log(`Updated ${connOut} (${CONNECTION_GUIDES.length} guides, ${connHtml.length} bytes)`);
