import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  const workspaceId = await getActiveWorkspaceId();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const category = (searchParams.get("category") || "").trim();

  const products = await prisma.product.findMany({
    where: {
      workspaceId,
      ...(category && category !== "ALL" ? { category } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { sku: { contains: q } },
              { description: { contains: q } },
              { category: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const body = await req.json();

    if (Array.isArray(body.products)) {
      let created = 0;
      for (const item of body.products) {
        if (!item.name) continue;
        const sku = String(item.sku || `SKU-${Date.now()}-${created}`);
        await prisma.product.upsert({
          where: { workspaceId_sku: { workspaceId, sku } },
          update: {
            name: String(item.name),
            category: String(item.category || "Uniformes"),
            description: String(item.description || ""),
            price: Number(item.price) || 0,
            cost: Number(item.cost) || 0,
          },
          create: {
            workspaceId,
            sku,
            name: String(item.name),
            category: String(item.category || "Uniformes"),
            description: String(item.description || ""),
            unit: String(item.unit || "Unidad"),
            price: Number(item.price) || 0,
            cost: Number(item.cost) || 0,
            wholesaleMinQty: Number(item.wholesaleMinQty) || 12,
            wholesalePrice: item.wholesalePrice ? Number(item.wholesalePrice) : null,
          },
        });
        created++;
      }
      return NextResponse.json({ ok: true, created }, { status: 201 });
    }

    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "El nombre del producto es obligatorio." }, { status: 400 });
    }
    const sku = String(body.sku || `PROD-${Date.now().toString().slice(-5)}`).trim().toUpperCase();

    const product = await prisma.product.create({
      data: {
        workspaceId,
        sku,
        name,
        category: String(body.category || "Uniformes"),
        description: String(body.description || ""),
        unit: String(body.unit || "Unidad"),
        price: Number(body.price) || 0,
        cost: Number(body.cost) || 0,
        wholesaleMinQty: Number(body.wholesaleMinQty) || 12,
        wholesalePrice: body.wholesalePrice ? Number(body.wholesalePrice) : null,
        active: body.active !== false,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error("Create product error:", err);
    return NextResponse.json({ error: "No se pudo guardar el producto (verifica SKU único)." }, { status: 500 });
  }
}
