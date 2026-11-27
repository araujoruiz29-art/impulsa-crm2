import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId, requireOwnerOrAdmin } from "@/lib/workspace";
import { isMaskedOrEmpty, maskSecret } from "@/lib/security";

function sanitizeAccount<T extends { smtpPass?: string | null; imapPass?: string | null }>(a: T) {
  return {
    ...a,
    smtpPass: maskSecret(a.smtpPass),
    imapPass: maskSecret(a.imapPass),
  };
}

export async function GET() {
  const workspaceId = await getActiveWorkspaceId();
  const accounts = await prisma.emailAccount.findMany({
    where: { workspaceId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ accounts: accounts.map(sanitizeAccount) });
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireOwnerOrAdmin();
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    const workspaceId = guard.workspaceId;
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
    const rawSmtpPass = isMaskedOrEmpty(body.smtpPass) ? "" : String(body.smtpPass).trim();
    const rawImapPass = isMaskedOrEmpty(body.imapPass) ? rawSmtpPass : String(body.imapPass).trim();

    if (body.id) {
      const existing = await prisma.emailAccount.findFirst({
        where: { id: String(body.id), workspaceId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Cuenta de correo no encontrada en esta empresa." }, { status: 404 });
      }
      const account = await prisma.emailAccount.update({
        where: { id: existing.id },
        data: {
          label: String(body.label || "Corporativo"),
          email,
          fromName: String(body.fromName || "Corporativo"),
          smtpHost: String(body.smtpHost || ""),
          smtpPort: Number(body.smtpPort) || 465,
          smtpSecure: body.smtpSecure !== false,
          smtpUser,
          ...(rawSmtpPass ? { smtpPass: rawSmtpPass } : {}),
          imapHost: String(body.imapHost || body.smtpHost || ""),
          imapPort: Number(body.imapPort) || 993,
          imapSecure: body.imapSecure !== false,
          imapUser,
          ...(rawImapPass ? { imapPass: rawImapPass } : {}),
          isDefault: Boolean(body.isDefault),
          active: body.active !== false,
        },
      });
      return NextResponse.json({ account: sanitizeAccount(account) });
    }

    const account = await prisma.emailAccount.upsert({
      where: { workspaceId_email: { workspaceId, email } },
      update: {
        label: String(body.label || "Corporativo"),
        fromName: String(body.fromName || "Corporativo"),
        smtpHost: String(body.smtpHost || ""),
        smtpPort: Number(body.smtpPort) || 465,
        smtpSecure: body.smtpSecure !== false,
        smtpUser,
        ...(rawSmtpPass ? { smtpPass: rawSmtpPass } : {}),
        imapHost: String(body.imapHost || body.smtpHost || ""),
        imapPort: Number(body.imapPort) || 993,
        imapSecure: body.imapSecure !== false,
        imapUser,
        ...(rawImapPass ? { imapPass: rawImapPass } : {}),
        isDefault: Boolean(body.isDefault),
        active: body.active !== false,
      },
      create: {
        workspaceId,
        label: String(body.label || "Corporativo"),
        email,
        fromName: String(body.fromName || "Corporativo"),
        smtpHost: String(body.smtpHost || ""),
        smtpPort: Number(body.smtpPort) || 465,
        smtpSecure: body.smtpSecure !== false,
        smtpUser,
        smtpPass: rawSmtpPass,
        imapHost: String(body.imapHost || body.smtpHost || ""),
        imapPort: Number(body.imapPort) || 993,
        imapSecure: body.imapSecure !== false,
        imapUser,
        imapPass: rawImapPass,
        isDefault: Boolean(body.isDefault),
        active: body.active !== false,
      },
    });

    return NextResponse.json({ account: sanitizeAccount(account) });
  } catch (err) {
    console.error("Save email account error:", err);
    return NextResponse.json({ error: "No se pudo guardar la cuenta de correo." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await requireOwnerOrAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const deleted = await prisma.emailAccount.deleteMany({
    where: { id, workspaceId: guard.workspaceId },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Cuenta de correo no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
