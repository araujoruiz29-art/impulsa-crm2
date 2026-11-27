import { NextRequest, NextResponse } from "next/server";
import { requireOwnerOrAdmin } from "@/lib/workspace";
import {
  buildBackupPayload,
  emailBackupSnapshot,
  restoreBackupPayload,
} from "@/lib/backup-service";

// GET: Download backup JSON (?full=1 is strictly SUPERADMIN; OWNER exports only own workspace; AGENT blocked)
export async function GET(req: NextRequest) {
  const guard = await requireOwnerOrAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const isSuperAdmin = guard.session.role === "SUPERADMIN";
  const { searchParams } = new URL(req.url);
  const fullMigration = searchParams.get("full") === "1" && isSuperAdmin;
  const workspaceId = guard.workspaceId;

  const { payload } = await buildBackupPayload({ workspaceId, fullMigration });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="respaldo-${
        fullMigration ? "migracion-completa" : workspaceId
      }-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

// POST: Restore backup JSON OR send instant email backup snapshot (OWNER / SUPERADMIN only)
export async function POST(req: NextRequest) {
  try {
    const guard = await requireOwnerOrAdmin();
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    const isSuperAdmin = guard.session.role === "SUPERADMIN";
    const activeWorkspaceId = guard.workspaceId;
    const data = await req.json();

    if (data?.action === "email_now") {
      const fullMigration = Boolean(data.full) && isSuperAdmin;
      const result = await emailBackupSnapshot({
        workspaceId: activeWorkspaceId,
        fullMigration,
        toEmail: typeof data.toEmail === "string" ? data.toEmail : undefined,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (!isSuperAdmin && data?.fullMigration) {
      return NextResponse.json(
        { error: "Solo el administrador principal puede restaurar migraciones multiempresa completas." },
        { status: 403 }
      );
    }

    const counts = await restoreBackupPayload(data, { isSuperAdmin, activeWorkspaceId });

    return NextResponse.json({
      ok: true,
      message: isSuperAdmin
        ? "Migración / restauración completada con éxito."
        : "Respaldo de tu empresa restaurado con éxito.",
      counts,
    });
  } catch (err) {
    console.error("Restore backup error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error restaurando respaldo JSON." },
      { status: 500 }
    );
  }
}
