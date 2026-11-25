import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET() {
  const workspaceId = await getActiveWorkspaceId();
  const accounts = await prisma.emailAccount.findMany({
    where: { workspaceId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "El correo electrónico es obligatorio." }, { status: 400 });
    }

    if (body.isDefault) {
      await prisma.emailAccount.updateMany({
        where: { workspaceId },
        data: { isDefault: false },
      });
    }

    const smtpUser = String(body.smtpUser || email).trim();
    const imapUser = String(body.imapUser || email).trim();
    const smtpPass = String(body.smtpPass || "");
    const imapPass = String(body.imapPass || smtpPass);

    const account = body.id
      ? await prisma.emailAccount.update({
          where: { id: String(body.id) },
          data: {
            label: String(body.label || "Corporativo"),
            email,
            fromName: String(body.fromName || "Caminante Corporativo"),
            smtpHost: String(body.smtpHost || "mail.elcaminantecr.com"),
            smtpPort: Number(body.smtpPort) || 465,
            smtpSecure: body.smtpSecure !== false,
            smtpUser,
            ...(smtpPass ? { smtpPass } : {}),
            imapHost: String(body.imapHost || body.smtpHost || "mail.elcaminantecr.com"),
            imapPort: Number(body.imapPort) || 993,
            imapSecure: body.imapSecure !== false,
            imapUser,
            ...(imapPass ? { imapPass } : {}),
            isDefault: Boolean(body.isDefault),
            active: body.active !== false,
          },
        })
      : await prisma.emailAccount.upsert({
          where: { workspaceId_email: { workspaceId, email } },
          update: {
            label: String(body.label || "Corporativo"),
            fromName: String(body.fromName || "Caminante Corporativo"),
            smtpHost: String(body.smtpHost || "mail.elcaminantecr.com"),
            smtpPort: Number(body.smtpPort) || 465,
            smtpSecure: body.smtpSecure !== false,
            smtpUser,
            ...(smtpPass ? { smtpPass } : {}),
            imapHost: String(body.imapHost || body.smtpHost || "mail.elcaminantecr.com"),
            imapPort: Number(body.imapPort) || 993,
            imapSecure: body.imapSecure !== false,
            imapUser,
            ...(imapPass ? { imapPass } : {}),
            isDefault: Boolean(body.isDefault),
            active: body.active !== false,
          },
          create: {
            workspaceId,
            label: String(body.label || "Corporativo"),
            email,
            fromName: String(body.fromName || "Caminante Corporativo"),
            smtpHost: String(body.smtpHost || "mail.elcaminantecr.com"),
            smtpPort: Number(body.smtpPort) || 465,
            smtpSecure: body.smtpSecure !== false,
            smtpUser,
            smtpPass,
            imapHost: String(body.imapHost || body.smtpHost || "mail.elcaminantecr.com"),
            imapPort: Number(body.imapPort) || 993,
            imapSecure: body.imapSecure !== false,
            imapUser,
            imapPass,
            isDefault: Boolean(body.isDefault),
            active: body.active !== false,
          },
        });

    return NextResponse.json({ account });
  } catch (err) {
    console.error("Save email account error:", err);
    return NextResponse.json({ error: "No se pudo guardar la cuenta de correo." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  await prisma.emailAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
