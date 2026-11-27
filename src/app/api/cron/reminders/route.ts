import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/workspace";
import { timingSafeEqualStr } from "@/lib/security";
import { sendWhatsAppCloudMessage } from "@/lib/meta";
import { sendWeeklyExecutiveReport } from "@/lib/weekly-report";

// Daily Cron (0 13 * * * = 7:00 AM CR): sends WhatsApp reminders for upcoming Bookings + Monday Weekly Executive Report
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const cronSecret = (process.env.CRON_SECRET || "").trim();
    const session = await getCurrentSession();
    const isSuperAdmin = session?.role === "SUPERADMIN";
    const hasValidCron = Boolean(cronSecret) && timingSafeEqualStr(authHeader, `Bearer ${cronSecret}`);

    if (!isSuperAdmin && !hasValidCron) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const now = new Date();
    const in36h = new Date(now.getTime() + 36 * 60 * 60 * 1000);

    const upcoming = await prisma.booking.findMany({
      where: {
        status: "CONFIRMADA",
        startsAt: { gte: now, lte: in36h },
      },
    });

    let remindersSent = 0;
    for (const b of upcoming) {
      if (!b.customerPhone) continue;
      const hoursLeft = (b.startsAt.getTime() - now.getTime()) / (60 * 60 * 1000);
      const timeStr = b.startsAt.toLocaleString("es-CR", { timeZone: "America/Costa_Rica" });

      if (hoursLeft <= 3 && !b.reminder2hSent) {
        await sendWhatsAppCloudMessage({
          workspaceId: b.workspaceId,
          to: b.customerPhone,
          text: `⏰ Recordatorio: tu cita de *${b.serviceName}* es hoy muy pronto (${timeStr}). ¡Te esperamos!`,
        });
        await prisma.booking.update({ where: { id: b.id }, data: { reminder2hSent: true, reminder24hSent: true } });
        remindersSent++;
      } else if (hoursLeft <= 36 && !b.reminder24hSent) {
        await sendWhatsAppCloudMessage({
          workspaceId: b.workspaceId,
          to: b.customerPhone,
          text: `📅 Hola ${b.customerName}, te recordamos tu cita de *${b.serviceName}* programada para ${timeStr}. Si necesitas reprogramar solo respóndenos por aquí.`,
        });
        await prisma.booking.update({ where: { id: b.id }, data: { reminder24hSent: true } });
        remindersSent++;
      }
    }

    // Weekly Executive Report on Mondays (7:00 AM Costa Rica / 13:00 UTC)
    let weeklyReportsSent = 0;
    const isMonday = now.getUTCDay() === 1;
    if (isMonday) {
      const companies = await prisma.companySettings.findMany({
        where: { active: true },
        select: { id: true },
      });
      for (const c of companies) {
        const res = await sendWeeklyExecutiveReport({ workspaceId: c.id });
        if (res.ok) weeklyReportsSent++;
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: now.toISOString(),
      remindersSent,
      weeklyReportsSent,
    });
  } catch (err) {
    console.error("Cron reminders error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error ejecutando cron." },
      { status: 500 }
    );
  }
}
