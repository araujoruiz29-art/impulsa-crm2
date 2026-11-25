import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const body = await req.json();

    const deleted = {
      conversations: 0,
      products: 0,
      alerts: 0,
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

    return NextResponse.json({
      ok: true,
      deleted,
      message: `Limpieza completada: ${deleted.conversations} chats de prueba, ${deleted.products} artículos del catálogo y ${deleted.alerts} avisos eliminados. Tus correos corporativos, clientes, proformas y horarios siguen intactos.`,
    });
  } catch (err) {
    console.error("Cleanup error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error ejecutando limpieza." },
      { status: 500 }
    );
  }
}
