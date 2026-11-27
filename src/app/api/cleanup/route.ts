import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId, requireOwnerOrAdmin } from "@/lib/workspace";

export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const body = await req.json();

    // Bulk destructive wipes require OWNER or SUPERADMIN (block AGENT role)
    const isBulkWipe = Boolean(
      body.clearNonEmailConversations ||
        body.clearProducts ||
        body.clearAlerts ||
        body.clearDemoBoard ||
        body.clearKanbanClients
    );
    if (isBulkWipe) {
      const guard = await requireOwnerOrAdmin();
      if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status });
      }
    }

    const deleted = {
      conversations: 0,
      products: 0,
      alerts: 0,
      quotes: 0,
      activities: 0,
      clients: 0,
    };

    // Delete a single conversation by ID
    if (typeof body.conversationId === "string" && body.conversationId.trim()) {
      const convId = body.conversationId.trim();
      const target = await prisma.conversation.findFirst({
        where: { id: convId, workspaceId },
        select: { id: true },
      });
      if (target) {
        const alertDel = await prisma.sellerAlert.deleteMany({
          where: { workspaceId, conversationId: target.id },
        });
        deleted.alerts += alertDel.count;
        await prisma.conversation.delete({ where: { id: target.id } });
        deleted.conversations += 1;
      }
      return NextResponse.json({
        ok: true,
        deleted,
        message: "Conversación eliminada correctamente.",
      });
    }

    // Delete all non-EMAIL conversations (keeps all corporate EMAIL threads intact)
    if (body.clearNonEmailConversations) {
      const nonEmailConvs = await prisma.conversation.findMany({
        where: {
          workspaceId,
          NOT: { channel: "EMAIL" },
        },
        select: { id: true },
      });
      const convIds = nonEmailConvs.map((c) => c.id);

      if (convIds.length > 0) {
        const alertDel = await prisma.sellerAlert.deleteMany({
          where: { workspaceId, conversationId: { in: convIds } },
        });
        deleted.alerts += alertDel.count;

        const convDel = await prisma.conversation.deleteMany({
          where: { workspaceId, id: { in: convIds } },
        });
        deleted.conversations += convDel.count;
      }
    }

    // Clear catalog products (QuoteItems preserve their title/price via onDelete: SetNull)
    if (body.clearProducts) {
      const prodDel = await prisma.product.deleteMany({
        where: { workspaceId },
      });
      deleted.products += prodDel.count;
    }

    // Optionally clear all seller alerts
    if (body.clearAlerts) {
      const alertDel = await prisma.sellerAlert.deleteMany({
        where: { workspaceId },
      });
      deleted.alerts += alertDel.count;
    }

    // Reset Dashboard demo metrics to zero while preserving all corporate EMAIL threads, settings, schedules & connections
    if (body.clearDemoBoard) {
      const [quoteDel, actDel, alertDel] = await Promise.all([
        prisma.quote.deleteMany({ where: { workspaceId } }),
        prisma.activity.deleteMany({ where: { workspaceId } }),
        prisma.sellerAlert.deleteMany({ where: { workspaceId } }),
      ]);
      deleted.quotes += quoteDel.count;
      deleted.activities += actDel.count;
      deleted.alerts += alertDel.count;

      // Find clients that belong to existing EMAIL conversations so real email threads keep their link
      const emailConvs = await prisma.conversation.findMany({
        where: { workspaceId, channel: "EMAIL" },
        select: { clientId: true },
      });
      const keepClientIds = emailConvs
        .map((c) => c.clientId)
        .filter((id): id is string => Boolean(id));

      // Delete demo clients not tied to any EMAIL conversation
      const clientDel = await prisma.client.deleteMany({
        where: {
          workspaceId,
          ...(keepClientIds.length > 0 ? { id: { notIn: keepClientIds } } : {}),
        },
      });
      deleted.clients += clientDel.count;

      // Zero out estimatedValue on remaining email-linked contacts & mark synced emails as read
      await Promise.all([
        prisma.client.updateMany({
          where: { workspaceId },
          data: { estimatedValue: 0 },
        }),
        prisma.conversation.updateMany({
          where: { workspaceId, channel: "EMAIL" },
          data: { unreadCount: 0 },
        }),
      ]);
    }

    // Clear ALL cards in Ventas · Kanban (Client rows) while preserving ALL corporate EMAIL conversations (onDelete: SetNull)
    if (body.clearKanbanClients) {
      const clientDel = await prisma.client.deleteMany({
        where: { workspaceId },
      });
      deleted.clients += clientDel.count;
    }

    return NextResponse.json({
      ok: true,
      deleted,
      message: body.clearKanbanClients
        ? `Ventas Kanban limpio: se quitaron ${deleted.clients} tarjetas/contactos. Tus conversaciones de correo corporativo, horarios y conexiones siguen intactos.`
        : body.clearDemoBoard
        ? `Tablero en cero listo: ${deleted.quotes} proformas demo, ${deleted.clients} clientes demo, ${deleted.activities} tareas y ${deleted.alerts} avisos eliminados; correos marcados como leídos. Tus correos, horarios y conexiones siguen intactos.`
        : `Limpieza completada: ${deleted.conversations} chats de prueba, ${deleted.products} artículos del catálogo y ${deleted.alerts} avisos eliminados. Tus correos corporativos, clientes, proformas y horarios siguen intactos.`,
    });
  } catch (err) {
    console.error("Cleanup error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error ejecutando limpieza." },
      { status: 500 }
    );
  }
}
