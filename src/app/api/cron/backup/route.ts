import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailBackupSnapshot } from "@/lib/backup-service";
import { getCurrentSession } from "@/lib/workspace";

// Automated weekly backup cron endpoint (triggered by Vercel Cron every Sunday 08:00 UTC / 02:00 AM CR)
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const cronSecret = process.env.CRON_SECRET || "";
    const isVercelCronHeader = req.headers.get("x-vercel-cron") === "1";
    const session = await getCurrentSession();
    const isSuperAdmin = session?.role === "SUPERADMIN";

    const authorized =
      isSuperAdmin ||
      (cronSecret ? authHeader === `Bearer ${cronSecret}` : isVercelCronHeader);

    if (!authorized) {
      return NextResponse.json({ error: "No autorizado para ejecutar respaldo programado." }, { status: 401 });
    }

    const results: Array<{ workspaceId: string; ok: boolean; detail: string }> = [];

    // 1. Send full multi-company master backup to SuperAdmin's default workspace email
    const masterRes = await emailBackupSnapshot({
      workspaceId: "default",
      fullMigration: true,
    });
    results.push({
      workspaceId: "ALL (Maestro)",
      ok: Boolean(masterRes.ok),
      detail: masterRes.ok ? masterRes.message || "Enviado" : masterRes.error || "Omitido",
    });

    // 2. Send isolated per-company backups to any other company with its own email configured
    const otherCompanies = await prisma.companySettings.findMany({
      where: { id: { not: "default" } },
      select: { id: true, email: true },
    });

    for (const comp of otherCompanies) {
      if (!comp.email) continue;
      const res = await emailBackupSnapshot({
        workspaceId: comp.id,
        fullMigration: false,
        toEmail: comp.email,
      });
      results.push({
        workspaceId: comp.id,
        ok: Boolean(res.ok),
        detail: res.ok ? res.message || "Enviado" : res.error || "Sin SMTP configurado",
      });
    }

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      results,
    });
  } catch (err) {
    console.error("Cron backup error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error en respaldo programado." },
      { status: 500 }
    );
  }
}
