import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, timingSafeEqualStr } from "@/lib/security";
import { normalizeCRPhone } from "@/lib/format";
import { pickNextRoundRobinAgent } from "@/lib/round-robin";
import { emitOutboundWebhook } from "@/lib/outbound-webhook";
import { logAuditEvent } from "@/lib/audit";

async function authenticateApiKey(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization") || "";
  const apiKeyHeader = req.headers.get("x-api-key") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : apiKeyHeader.trim();
  if (!token || token.length < 16) return null;

  const candidates = await prisma.integrationSettings.findMany({
    where: { publicApiKey: { not: "" } },
    select: { id: true, publicApiKey: true },
  });

  for (const row of candidates) {
    if (row.publicApiKey && timingSafeEqualStr(token, row.publicApiKey)) {
      const company = await prisma.companySettings.findUnique({
        where: { id: row.id },
        select: { active: true },
      });
      if (company?.active) return row.id;
    }
  }
  return null;
}

// GET /api/v1/leads — Read recent leads for external ERP / Odoo / Zapier / Make / n8n
export async function GET(req: NextRequest) {
  const workspaceId = await authenticateApiKey(req);
  if (!workspaceId) {
    return NextResponse.json({ error: "API Key inválida o ausente (Authorization: Bearer <key>)." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 30));

  const clients = await prisma.client.findMany({
    where: { workspaceId, contactType: "CLIENTE" },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      company: true,
      contactName: true,
      phone: true,
      whatsapp: true,
      email: true,
      stage: true,
      source: true,
      tags: true,
      estimatedValue: true,
      assignedTo: true,
      qualificationStatus: true,
      qualificationScore: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, workspaceId, count: clients.length, leads: clients });
}

// POST /api/v1/leads — Push external lead from Shopify / WooCommerce / Odoo / Zapier / Make / n8n into impulsa CRM
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`api_v1:${ip}`, 60, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit excedido." }, { status: 429 });
    }

    const workspaceId = await authenticateApiKey(req);
    if (!workspaceId) {
      return NextResponse.json({ error: "API Key inválida o ausente." }, { status: 401 });
    }

    const body = await req.json();
    const companyName = String(body.company || body.name || "").trim();
    if (!companyName) {
      return NextResponse.json({ error: "El campo 'company' o 'name' es obligatorio." }, { status: 400 });
    }

    const phone = normalizeCRPhone(String(body.phone || body.whatsapp || ""));
    const rr = await pickNextRoundRobinAgent(workspaceId);

    const client = await prisma.client.create({
      data: {
        workspaceId,
        company: companyName,
        contactName: String(body.contactName || body.name || companyName).trim(),
        phone,
        whatsapp: phone,
        email: String(body.email || "").trim(),
        address: String(body.address || "").trim(),
        stage: String(body.stage || "NUEVO").toUpperCase(),
        source: String(body.source || "API_EXTERNA").toUpperCase(),
        tags: String(body.tags || "api").trim(),
        estimatedValue: Math.max(0, Number(body.estimatedValue) || 0),
        notes: String(body.notes || "").trim(),
        assignedTo: String(body.assignedTo || rr?.agentName || "Asesor"),
      },
    });

    await logAuditEvent({
      workspaceId,
      actorEmail: "api-v1",
      actorRole: "API",
      action: "API_LEAD_CREATED",
      entityType: "Client",
      entityId: client.id,
      summary: `Lead creado vía API Pública (${client.source}): ${client.company}`,
    });

    emitOutboundWebhook({
      workspaceId,
      event: "CLIENT_CREATED",
      payload: { clientId: client.id, company: client.company, phone: client.phone, source: client.source },
    }).catch(() => {});

    return NextResponse.json({ ok: true, lead: client }, { status: 201 });
  } catch (err) {
    console.error("API v1 POST lead error:", err);
    return NextResponse.json({ error: "Error creando lead vía API." }, { status: 500 });
  }
}
