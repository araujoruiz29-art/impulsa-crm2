import { prisma } from "./prisma";
import { getCurrentSession } from "./workspace";

export async function logAuditEvent(input: {
  workspaceId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  actorEmail?: string;
  actorRole?: string;
}) {
  try {
    let actorEmail = input.actorEmail || "";
    let actorRole = input.actorRole || "";
    if (!actorEmail) {
      const session = await getCurrentSession();
      actorEmail = session?.email || "sistema";
      actorRole = session?.role || "SYSTEM";
    }
    await prisma.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        actorEmail,
        actorRole,
        action: input.action,
        entityType: input.entityType || "",
        entityId: input.entityId || "",
        summary: input.summary.slice(0, 500),
      },
    });
  } catch (err) {
    console.warn("AuditLog non-blocking warning:", err);
  }
}
