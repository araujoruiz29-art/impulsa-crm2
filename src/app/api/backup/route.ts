import { NextRequest, NextResponse } from "next/server";
import { getActiveWorkspaceId, getCurrentSession } from "@/lib/workspace";
import {
  buildBackupPayload,
  emailBackupSnapshot,
  restoreBackupPayload,
} from "@/lib/backup-service";

// GET: Download backup JSON (?full=1 is restricted to SUPERADMIN; OWNER exports only their own workspace)
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  const isSuperAdmin = !session || session.role === "SUPERADMIN";
  const { searchParams } = new URL(req.url);
  const fullMigration = searchParams.get("full") === "1" && isSuperAdmin;
  const workspaceId = await getActiveWorkspaceId();

  const { payload } = await buildBackupPayload({ workspaceId, fullMigration });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="respaldo-${
        fullMigration ? "migracion-completa" : workspaceId
      }-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

// POST: Restore backup JSON OR send instant email backup snapshot
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    const isSuperAdmin = !session || session.role === "SUPERADMIN";
    const activeWorkspaceId = await getActiveWorkspaceId();
    const data = await req.json();

    // Instant email backup trigger from UI
    if (data?.action === "email_now") {
      const fullMigration = Boolean(data.full) && isSuperAdmin;
      const result = await emailBackupSnapshot({
        workspaceId: activeWorkspaceId,
        fullMigration,
        toEmail: typeof data.toEmail === "string" ? data.toEmail : undefined,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    // Reject cross-workspace restore attempts by non-superadmin
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
