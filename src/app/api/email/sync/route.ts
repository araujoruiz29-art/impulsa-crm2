import { NextRequest, NextResponse } from "next/server";
import { syncCorporateInbox, testImapConnection, testSmtpConnection } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "sync";
    const accountId = body.accountId ? String(body.accountId) : undefined;

    if (action === "test_smtp") {
      const res = await testSmtpConnection(accountId);
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }
    if (action === "test_imap") {
      const res = await testImapConnection(accountId);
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    const res = await syncCorporateInbox(Number(body.limit) || 15, accountId);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error de conexión de correo." },
      { status: 500 }
    );
  }
}
