import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeCRPhone } from "@/lib/format";
import { runTriggerAutomations } from "@/lib/automations";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      quotes: { orderBy: { number: "desc" }, include: { items: true } },
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        include: { messages: { orderBy: { createdAt: "desc" }, take: 5 } },
      },
      activities: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ client });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.code !== undefined) data.code = String(body.code);
    if (body.company !== undefined) data.company = String(body.company);
    if (body.contactName !== undefined) data.contactName = String(body.contactName);
    if (body.phone !== undefined) {
      data.phone = String(body.phone);
      if (body.whatsapp === undefined) {
        data.whatsapp = normalizeCRPhone(String(body.phone));
      }
    }
    if (body.whatsapp !== undefined) data.whatsapp = normalizeCRPhone(String(body.whatsapp));
    if (body.email !== undefined) data.email = String(body.email);
    if (body.address !== undefined) data.address = String(body.address);
    if (body.stage !== undefined) data.stage = String(body.stage);
    if (body.source !== undefined) data.source = String(body.source);
    if (body.tags !== undefined) data.tags = String(body.tags);
    if (body.estimatedValue !== undefined) data.estimatedValue = Number(body.estimatedValue) || 0;
    if (body.notes !== undefined) data.notes = String(body.notes);
    if (body.assignedTo !== undefined) data.assignedTo = String(body.assignedTo);
    if (body.metaCampaign !== undefined) data.metaCampaign = String(body.metaCampaign);

    const client = await prisma.client.update({ where: { id }, data });

    if (body.stage && body.stage !== existing.stage) {
      await prisma.activity.create({
        data: {
          clientId: id,
          type: "NOTA",
          title: `Cambio de etapa: ${existing.stage} → ${body.stage}`,
          completed: true,
        },
      });
      await runTriggerAutomations("STAGE_CHANGED", { clientId: id });
    }

    return NextResponse.json({ client });
  } catch (err) {
    console.error("Update client error:", err);
    return NextResponse.json({ error: "Error actualizando cliente." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
