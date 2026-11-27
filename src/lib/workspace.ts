import { cookies } from "next/headers";
import { AuthSession, SESSION_COOKIE, verifySessionToken } from "./auth";
import { prisma } from "./prisma";

export const WORKSPACE_COOKIE = "crm_workspace_id";

export async function getCurrentSession(): Promise<AuthSession | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Returns the active workspace ID, strictly enforcing multi-tenant ownership & active company status:
 * - SUPERADMIN can access any existing workspace (defaults to "default").
 * - AGENT (vendedor) is strictly locked to their assigned active user.workspaceId & active company.
 * - OWNER users can ONLY access active workspaces where ownerUserId === session.userId.
 * - Unauthenticated requests fail-closed (never silently fall back to "default").
 */
export async function getActiveWorkspaceId(): Promise<string> {
  try {
    const store = await cookies();
    const requestedId = store.get(WORKSPACE_COOKIE)?.value?.trim() || "";
    const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);

    if (!session) {
      if (process.env.CRM_DISABLE_AUTH === "true") {
        return requestedId || "default";
      }
      return "__unauthenticated";
    }

    if (session.role === "AGENT") {
      const agent = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { workspaceId: true, active: true },
      });
      if (agent?.active && agent.workspaceId) {
        const company = await prisma.companySettings.findUnique({
          where: { id: agent.workspaceId },
          select: { id: true, active: true },
        });
        if (company?.active) return company.id;
      }
      return `__disabled_${session.userId}`;
    }

    if (session.role !== "SUPERADMIN") {
      if (requestedId) {
        const owned = await prisma.companySettings.findFirst({
          where: { id: requestedId, ownerUserId: session.userId, active: true },
          select: { id: true },
        });
        if (owned) return owned.id;
      }
      const firstOwned = await prisma.companySettings.findFirst({
        where: { ownerUserId: session.userId, active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      return firstOwned?.id || `__unowned_${session.userId}`;
    }

    if (requestedId) return requestedId;
    return "default";
  } catch {
    // Fallback only outside Next.js HTTP request context (CLI scripts)
    return "default";
  }
}

export async function requireOwnerOrAdmin(): Promise<
  { ok: true; session: AuthSession; workspaceId: string } | { ok: false; status: number; error: string }
> {
  const session = await getCurrentSession();
  if (!session) {
    if (process.env.CRM_DISABLE_AUTH === "true") {
      const workspaceId = await getActiveWorkspaceId();
      return {
        ok: true,
        session: { userId: "superadmin", email: "local@dev", role: "SUPERADMIN" },
        workspaceId,
      };
    }
    return { ok: false, status: 401, error: "Sesión requerida. Inicia sesión nuevamente." };
  }
  if (session.role === "AGENT") {
    return {
      ok: false,
      status: 403,
      error: "Solo el dueño de la empresa o el administrador puede realizar esta acción.",
    };
  }
  const workspaceId = await getActiveWorkspaceId();
  if (workspaceId.startsWith("__")) {
    return { ok: false, status: 403, error: "Tu empresa se encuentra suspendida o sin acceso activo." };
  }
  return { ok: true, session, workspaceId };
}

export async function requireSuperAdmin(): Promise<
  { ok: true; session: AuthSession } | { ok: false; status: number; error: string }
> {
  const session = await getCurrentSession();
  if (!session) {
    if (process.env.CRM_DISABLE_AUTH === "true") {
      return { ok: true, session: { userId: "superadmin", email: "local@dev", role: "SUPERADMIN" } };
    }
    return { ok: false, status: 401, error: "No autorizado." };
  }
  if (session.role !== "SUPERADMIN") {
    return { ok: false, status: 403, error: "Solo el SuperAdmin puede gestionar compañías." };
  }
  return { ok: true, session };
}
