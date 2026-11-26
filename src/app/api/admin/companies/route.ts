import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/workspace";
import { hashPassword } from "@/lib/password";

// SuperAdmin-only SaaS companies control panel API
export async function GET() {
  const session = await getCurrentSession();
  if (session && session.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Solo el SuperAdmin puede gestionar compañías." }, { status: 403 });
  }

  const companies = await prisma.companySettings.findMany({
    orderBy: { createdAt: "asc" },
  });

  const [integrationsList, usersList] = await Promise.all([
    prisma.integrationSettings.findMany(),
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, workspaceId: true, active: true },
    }),
  ]);

  const intById = new Map(integrationsList.map((i) => [i.id, i]));
  const userById = new Map(usersList.map((u) => [u.id, u]));

  const rows = await Promise.all(
    companies.map(async (c) => {
      const [clientsCount, conversationsCount, quotesCount, emailAccountsCount] = await Promise.all([
        prisma.client.count({ where: { workspaceId: c.id, contactType: "CLIENTE" } }),
        prisma.conversation.count({ where: { workspaceId: c.id } }),
        prisma.quote.count({ where: { workspaceId: c.id } }),
        prisma.emailAccount.count({ where: { workspaceId: c.id, active: true } }),
      ]);

      const integ = intById.get(c.id);
      const owner = c.ownerUserId !== "superadmin" ? userById.get(c.ownerUserId) : null;
      const agentsCount = usersList.filter((u) => u.workspaceId === c.id && u.role === "AGENT").length;

      return {
        id: c.id,
        brandName: c.brandName,
        companyName: c.companyName,
        email: c.email,
        phone: c.phone || c.whatsapp,
        active: c.active,
        plan: c.plan || "PRO",
        suspendedReason: c.suspendedReason || "",
        createdAt: c.createdAt,
        ownerEmail: owner?.email || (c.ownerUserId === "superadmin" ? "SuperAdmin" : ""),
        ownerName: owner?.name || c.defaultSeller,
        ownerUserId: c.ownerUserId,
        stats: {
          clientsCount,
          conversationsCount,
          quotesCount,
          agentsCount,
        },
        connections: {
          whatsapp: Boolean(integ?.metaAccessToken && integ?.metaPhoneNumberId),
          social: Boolean(
            (integ?.metaPageAccessToken || integ?.metaAccessToken) &&
              (integ?.metaPageId || integ?.metaIgAccountId)
          ),
          email: emailAccountsCount > 0 || Boolean(integ?.smtpHost && integ?.smtpUser && integ?.smtpPass),
          ai: Boolean(integ?.aiApiKey),
        },
      };
    })
  );

  return NextResponse.json({ companies: rows });
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (session && session.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Solo el SuperAdmin puede modificar compañías." }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body.id || "");
    if (!id) {
      return NextResponse.json({ error: "ID de empresa requerido." }, { status: 400 });
    }

    if (id === "default" && body.active === false) {
      return NextResponse.json(
        { error: "No puedes suspender la empresa principal del SuperAdmin." },
        { status: 400 }
      );
    }

    const updateData: { active?: boolean; plan?: string; suspendedReason?: string } = {};
    if (body.active !== undefined) updateData.active = Boolean(body.active);
    if (typeof body.plan === "string" && body.plan.trim()) updateData.plan = body.plan.trim().toUpperCase();
    if (body.suspendedReason !== undefined) updateData.suspendedReason = String(body.suspendedReason);

    const updated = await prisma.companySettings.update({
      where: { id },
      data: updateData,
    });

    // Optional: SuperAdmin password reset for the company owner
    if (
      typeof body.resetOwnerPassword === "string" &&
      body.resetOwnerPassword.length >= 6 &&
      updated.ownerUserId &&
      updated.ownerUserId !== "superadmin"
    ) {
      await prisma.user.update({
        where: { id: updated.ownerUserId },
        data: { passwordHash: hashPassword(body.resetOwnerPassword) },
      });
    }

    return NextResponse.json({ ok: true, company: updated });
  } catch (err) {
    console.error("Admin patch company error:", err);
    return NextResponse.json({ error: "No se pudo actualizar la compañía." }, { status: 500 });
  }
}
