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
 * Returns the active workspace ID, strictly enforcing multi-tenant ownership:
 * - SUPERADMIN can access any existing workspace (defaults to "default").
 * - Regular OWNER users can ONLY access workspaces where ownerUserId === session.userId.
 */
export async function getActiveWorkspaceId(): Promise<string> {
  try {
    const store = await cookies();
    const requestedId = store.get(WORKSPACE_COOKIE)?.value?.trim() || "";
    const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);

    if (session && session.role !== "SUPERADMIN") {
      if (requestedId) {
        const owned = await prisma.companySettings.findFirst({
          where: { id: requestedId, ownerUserId: session.userId },
          select: { id: true },
        });
        if (owned) return owned.id;
      }
      const firstOwned = await prisma.companySettings.findFirst({
        where: { ownerUserId: session.userId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      return firstOwned?.id || `__unowned_${session.userId}`;
    }

    if (requestedId) return requestedId;
  } catch {
    // Fallback outside request context (scripts / webhooks)
  }
  return "default";
}
