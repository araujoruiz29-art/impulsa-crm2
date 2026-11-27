import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const workspaceId = await getActiveWorkspaceId();
  const { id } = await context.params;
  const body = await req.json();

  const existing = await prisma.product.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(body.sku !== undefined ? { sku: String(body.sku) } : {}),
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.category !== undefined ? { category: String(body.category) } : {}),
      ...(body.description !== undefined ? { description: String(body.description) } : {}),
      ...(body.unit !== undefined ? { unit: String(body.unit) } : {}),
      ...(body.price !== undefined ? { price: Number(body.price) || 0 } : {}),
      ...(body.cost !== undefined ? { cost: Number(body.cost) || 0 } : {}),
      ...(body.wholesaleMinQty !== undefined ? { wholesaleMinQty: Number(body.wholesaleMinQty) || 12 } : {}),
      ...(body.wholesalePrice !== undefined
        ? { wholesalePrice: body.wholesalePrice === "" || body.wholesalePrice === null ? null : Number(body.wholesalePrice) }
        : {}),
      ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
    },
  });

  return NextResponse.json({ product });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const workspaceId = await getActiveWorkspaceId();
  const { id } = await context.params;
  const deleted = await prisma.product.deleteMany({ where: { id, workspaceId } });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
