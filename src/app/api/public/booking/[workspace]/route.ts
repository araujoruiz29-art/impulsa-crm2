import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { normalizeCRPhone } from "@/lib/format";
import { emitOutboundWebhook } from "@/lib/outbound-webhook";
import { pickNextRoundRobinAgent } from "@/lib/round-robin";

interface BookingHoursConfig {
  days: number[];
  start: string;
  end: string;
  slotMinutes: number;
}

function parseHours(raw: string): BookingHoursConfig {
  try {
    const p = JSON.parse(raw || "{}");
    return {
      days: Array.isArray(p.days) ? p.days : [1, 2, 3, 4, 5],
      start: typeof p.start === "string" ? p.start : "08:00",
      end: typeof p.end === "string" ? p.end : "17:00",
      slotMinutes: Number(p.slotMinutes) || 30,
    };
  } catch {
    return { days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00", slotMinutes: 30 };
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ workspace: string }> }) {
  try {
    const { workspace } = await context.params;
    const { searchParams } = new URL(req.url);
    const dateStr = (searchParams.get("date") || new Date().toISOString().slice(0, 10)).slice(0, 10);

    const company = await prisma.companySettings.findUnique({
      where: { id: workspace },
      select: {
        id: true,
        active: true,
        publicBookingEnabled: true,
        bookingHoursJson: true,
        brandName: true,
        companyName: true,
        primaryColor: true,
        accentColor: true,
        logoPath: true,
        address: true,
        whatsapp: true,
        phone: true,
      },
    });

    if (!company || !company.active || !company.publicBookingEnabled) {
      return NextResponse.json({ error: "Agenda pública no disponible." }, { status: 404 });
    }

    const cfg = parseHours(company.bookingHoursJson);
    const dayStart = new Date(`${dateStr}T00:00:00.000-06:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999-06:00`);

    const existing = await prisma.booking.findMany({
      where: {
        workspaceId: company.id,
        status: "CONFIRMADA",
        startsAt: { gte: dayStart, lte: dayEnd },
      },
      select: { startsAt: true },
    });

    const bookedTimes = new Set(existing.map((b) => b.startsAt.getTime()));
    const [sh, sm] = cfg.start.split(":").map(Number);
    const [eh, em] = cfg.end.split(":").map(Number);
    const startMin = (sh || 8) * 60 + (sm || 0);
    const endMin = (eh || 17) * 60 + (em || 0);

    const slots: Array<{ iso: string; label: string; available: boolean }> = [];
    for (let m = startMin; m < endMin; m += cfg.slotMinutes) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const iso = `${dateStr}T${hh}:${mm}:00-06:00`;
      const dt = new Date(iso);
      slots.push({
        iso: dt.toISOString(),
        label: `${hh}:${mm}`,
        available: dt.getTime() > Date.now() && !bookedTimes.has(dt.getTime()),
      });
    }

    return NextResponse.json({ company, date: dateStr, slotMinutes: cfg.slotMinutes, slots });
  } catch (err) {
    console.error("Public booking GET error:", err);
    return NextResponse.json({ error: "Error cargando disponibilidad." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ workspace: string }> }) {
  try {
    const { workspace } = await context.params;
    const ip = getClientIp(req);
    const rl = checkRateLimit(`pubbook:${ip}:${workspace}`, 8, 30 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Demasiadas reservas recientes. Intenta más tarde." }, { status: 429 });
    }

    const company = await prisma.companySettings.findUnique({
      where: { id: workspace },
      select: { id: true, active: true, publicBookingEnabled: true, brandName: true, defaultSeller: true },
    });
    if (!company || !company.active || !company.publicBookingEnabled) {
      return NextResponse.json({ error: "Agenda pública no disponible." }, { status: 404 });
    }

    const body = await req.json();
    const customerName = String(body.name || "").trim();
    const customerPhone = normalizeCRPhone(String(body.phone || ""));
    const customerEmail = String(body.email || "").trim();
    const serviceName = String(body.serviceName || "Cita / Demostración").trim();
    const notes = String(body.notes || "").trim();
    const startsAt = new Date(String(body.startsAt || ""));

    if (!customerName || !customerPhone || Number.isNaN(startsAt.getTime())) {
      return NextResponse.json(
        { error: "Completa tu nombre, WhatsApp y elige un horario válido." },
        { status: 400 }
      );
    }

    const conflict = await prisma.booking.findFirst({
      where: { workspaceId: company.id, status: "CONFIRMADA", startsAt },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json({ error: "Ese horario acaba de ocuparse. Elige otro disponible." }, { status: 409 });
    }

    const rr = await pickNextRoundRobinAgent(company.id);
    const assignedTo = rr?.agentName || company.defaultSeller || "Asesor";

    const client = await prisma.client.create({
      data: {
        workspaceId: company.id,
        company: customerName,
        contactName: customerName,
        phone: customerPhone,
        whatsapp: customerPhone,
        email: customerEmail,
        stage: "CALIFICADO",
        source: "AGENDA_PUBLICA",
        tags: "cita-agendada",
        qualificationScore: 80,
        qualificationStatus: "CALIENTE",
        assignedTo,
        notes: `Cita reservada: ${serviceName}${notes ? `\n${notes}` : ""}`,
      },
    });

    const booking = await prisma.booking.create({
      data: {
        workspaceId: company.id,
        clientId: client.id,
        customerName,
        customerPhone,
        customerEmail,
        serviceName,
        startsAt,
        notes,
        status: "CONFIRMADA",
      },
    });

    await Promise.all([
      prisma.activity.create({
        data: {
          workspaceId: company.id,
          clientId: client.id,
          type: "CITA",
          title: `📅 Cita: ${serviceName} · ${customerName}`,
          description: `Tel: ${customerPhone}${notes ? ` · ${notes}` : ""}`,
          dueDate: startsAt,
          completed: false,
        },
      }),
      prisma.sellerAlert.create({
        data: {
          workspaceId: company.id,
          clientId: client.id,
          title: `📅 Nueva cita agendada (${customerName})`,
          buyingSignals: `${serviceName} · ${startsAt.toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })}`,
          suggestedNextStep: `Confirmar asistencia por WhatsApp al ${customerPhone}.`,
          score: 88,
          priority: "ALTA",
        },
      }),
    ]);

    emitOutboundWebhook({
      workspaceId: company.id,
      event: "BOOKING_CREATED",
      payload: {
        bookingId: booking.id,
        clientId: client.id,
        customerName,
        customerPhone,
        serviceName,
        startsAt: startsAt.toISOString(),
        assignedTo,
      },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      booking,
      message: `✅ ¡Cita confirmada con ${company.brandName}! Te enviaremos recordatorio por WhatsApp antes de la reunión.`,
    });
  } catch (err) {
    console.error("Public booking POST error:", err);
    return NextResponse.json({ error: "Error registrando cita." }, { status: 500 });
  }
}
