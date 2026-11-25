import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeCRPhone } from "@/lib/format";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const stage = (searchParams.get("stage") || "").trim();
  const source = (searchParams.get("source") || "").trim();

  const clients = await prisma.client.findMany({
    where: {
      workspaceId,
      ...(stage && stage !== "ALL" ? { stage } : {}),
      ...(source && source !== "ALL" ? { source } : {}),
      ...(q
        ? {
            OR: [
              { company: { contains: q } },
              { contactName: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q } },
              { tags: { contains: q } },
              { code: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { quotes: true, conversations: true, activities: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const body = await req.json();

    // Support bulk import array
    if (Array.isArray(body.clients)) {
      let created = 0;
      for (const item of body.clients) {
        if (!item.company && !item.contactName) continue;
        await prisma.client.create({
          data: {
            workspaceId,
            code: String(item.code || ""),
            company: String(item.company || item.contactName || "Sin nombre"),
            contactName: String(item.contactName || ""),
            phone: String(item.phone || ""),
            whatsapp: normalizeCRPhone(item.whatsapp || item.phone || ""),
            email: String(item.email || ""),
            address: String(item.address || ""),
            stage: String(item.stage || "NUEVO"),
            source: String(item.source || "MANUAL"),
            tags: String(item.tags || ""),
            estimatedValue: Number(item.estimatedValue) || 0,
            notes: String(item.notes || ""),
            assignedTo: String(item.assignedTo || "Jelsing R."),
          },
        });
        created++;
      }
      return NextResponse.json({ ok: true, created }, { status: 201 });
    }

    const company = String(body.company || body.contactName || "").trim();
    if (!company) {
      return NextResponse.json({ error: "El nombre de empresa o cliente es obligatorio." }, { status: 400 });
    }

    const client = await prisma.client.create({
      data: {
        workspaceId,
        code: String(body.code || "").trim(),
        company,
        contactName: String(body.contactName || "").trim(),
        phone: String(body.phone || "").trim(),
        whatsapp: normalizeCRPhone(body.whatsapp || body.phone || ""),
        email: String(body.email || "").trim(),
        address: String(body.address || "").trim(),
        stage: String(body.stage || "NUEVO"),
        source: String(body.source || "WHATSAPP"),
        tags: String(body.tags || "").trim(),
        estimatedValue: Number(body.estimatedValue) || 0,
        notes: String(body.notes || "").trim(),
        assignedTo: String(body.assignedTo || "Jelsing R."),
        metaCampaign: String(body.metaCampaign || "").trim(),
      },
    });

    await prisma.activity.create({
      data: {
        workspaceId,
        clientId: client.id,
        type: "NOTA",
        title: `Cliente creado (${client.source})`,
        description: `Alta de ${client.company} en etapa ${client.stage}.`,
        completed: true,
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (err) {
    console.error("Create client error:", err);
    return NextResponse.json({ error: "No se pudo crear el cliente." }, { status: 500 });
  }
}
