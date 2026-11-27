import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId, getCurrentSession, requireOwnerOrAdmin } from "@/lib/workspace";
import { hashPassword } from "@/lib/password";
import { getAuthConfig } from "@/lib/auth";

export async function GET() {
  const session = await getCurrentSession();
  const workspaceId = await getActiveWorkspaceId();

  const company = await prisma.companySettings.findUnique({
    where: { id: workspaceId },
    select: { id: true, brandName: true, ownerUserId: true },
  });

  const members = await prisma.user.findMany({
    where: { workspaceId, role: "AGENT" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });

  const owner =
    company?.ownerUserId && company.ownerUserId !== "superadmin"
      ? await prisma.user.findUnique({
          where: { id: company.ownerUserId },
          select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
        })
      : null;

  return NextResponse.json({
    workspaceId,
    brandName: company?.brandName || "",
    canManage: Boolean(
      process.env.CRM_DISABLE_AUTH === "true" ||
        (session && (session.role === "SUPERADMIN" || session.role === "OWNER"))
    ),
    owner,
    members,
  });
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireOwnerOrAdmin();
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const workspaceId = guard.workspaceId;
    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!name) {
      return NextResponse.json({ error: "Escribe el nombre del vendedor." }, { status: 400 });
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Ingresa un correo electrónico válido." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña del vendedor debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    const cfg = getAuthConfig();
    if (email === cfg.adminEmail) {
      return NextResponse.json({ error: "Ese correo está reservado para el administrador." }, { status: 409 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un usuario registrado con ese correo." },
        { status: 409 }
      );
    }

    const member = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
        role: "AGENT",
        workspaceId,
        active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, member }, { status: 201 });
  } catch (err) {
    console.error("Create team member error:", err);
    return NextResponse.json({ error: "No se pudo crear el usuario vendedor." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const guard = await requireOwnerOrAdmin();
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    const workspaceId = guard.workspaceId;
    const body = await req.json();
    const id = String(body.id || "");
    if (!id) {
      return NextResponse.json({ error: "ID de usuario requerido." }, { status: 400 });
    }

    const target = await prisma.user.findFirst({
      where: { id, workspaceId, role: "AGENT" },
    });
    if (!target) {
      return NextResponse.json({ error: "Vendedor no encontrado en esta empresa." }, { status: 404 });
    }

    const updateData: { active?: boolean; name?: string; passwordHash?: string } = {};
    if (body.active !== undefined) updateData.active = Boolean(body.active);
    if (typeof body.name === "string" && body.name.trim()) updateData.name = body.name.trim();
    if (typeof body.newPassword === "string" && body.newPassword.length >= 6) {
      updateData.passwordHash = hashPassword(body.newPassword);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, member: updated });
  } catch (err) {
    console.error("Patch team member error:", err);
    return NextResponse.json({ error: "No se pudo actualizar el vendedor." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireOwnerOrAdmin();
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    const workspaceId = guard.workspaceId;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json({ error: "ID requerido." }, { status: 400 });
    }

    const deleted = await prisma.user.deleteMany({
      where: { id, workspaceId, role: "AGENT" },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "Vendedor no encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete team member error:", err);
    return NextResponse.json({ error: "No se pudo eliminar el vendedor." }, { status: 500 });
  }
}
