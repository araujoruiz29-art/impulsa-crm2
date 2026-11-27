import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateProformaPdf } from "@/lib/pdf";
import { sanitizeFilename } from "@/lib/format";
import { getActiveWorkspaceId, getCurrentSession } from "@/lib/workspace";
import { verifyQuotePdfToken } from "@/lib/security";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const download = searchParams.get("download") === "1";
    const sig = searchParams.get("sig");

    const hasValidSig = verifyQuotePdfToken(id, sig);
    const session = hasValidSig ? null : await getCurrentSession();

    if (!hasValidSig && !session && process.env.CRM_DISABLE_AUTH !== "true") {
      return NextResponse.json(
        { error: "Enlace de proforma no autorizado. Inicia sesión o usa el enlace firmado." },
        { status: 401 }
      );
    }

    const quote = hasValidSig
      ? await prisma.quote.findUnique({
          where: { id },
          include: { items: { orderBy: { sortOrder: "asc" } } },
        })
      : await prisma.quote.findFirst({
          where: { id, workspaceId: await getActiveWorkspaceId() },
          include: { items: { orderBy: { sortOrder: "asc" } } },
        });

    if (!quote) {
      return NextResponse.json({ error: "Proforma no encontrada." }, { status: 404 });
    }

    const pdfBytes = await generateProformaPdf(quote);
    const filename = `${quote.number}-${sanitizeFilename(quote.clientCompany)}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: "Error generando el PDF de la proforma." }, { status: 500 });
  }
}
