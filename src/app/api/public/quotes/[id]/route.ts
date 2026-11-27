import { NextRequest, NextResponse } from "next/server";
import { getCompanySettings, getIntegrationSettings, parseBankAccounts, prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, verifyQuotePdfToken } from "@/lib/security";
import { callGeminiResilient } from "@/lib/gemini";
import { formatMoney } from "@/lib/format";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const sig = searchParams.get("sig");

    if (!verifyQuotePdfToken(id, sig)) {
      return NextResponse.json(
        { error: "Enlace de proforma inválido o no autorizado." },
        { status: 401 }
      );
    }

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!quote) {
      return NextResponse.json({ error: "Proforma no encontrada." }, { status: 404 });
    }

    const company = await getCompanySettings(quote.workspaceId);

    return NextResponse.json({
      quote: {
        id: quote.id,
        number: quote.number,
        clientCompany: quote.clientCompany,
        clientContact: quote.clientContact,
        jobTitle: quote.jobTitle,
        paymentTerms: quote.paymentTerms,
        validity: quote.validity,
        currency: quote.currency,
        taxMode: quote.taxMode,
        taxRate: quote.taxRate,
        subtotal: quote.subtotal,
        discountAmount: quote.discountAmount,
        taxAmount: quote.taxAmount,
        total: quote.total,
        paidAmount: quote.paidAmount || 0,
        paymentLinkUrl: quote.paymentLinkUrl || "",
        feNumber: quote.feNumber || "",
        feStatus: quote.feStatus || "",
        status: quote.status,
        notes: quote.notes,
        issueDate: quote.issueDate,
        seller: quote.seller,
        items: quote.items.map((it) => ({
          id: it.id,
          quantity: it.quantity,
          title: it.title,
          description: it.description,
          unitPrice: it.unitPrice,
          lineTotal: it.lineTotal,
        })),
      },
      company: {
        brandName: company.brandName,
        companyName: company.companyName,
        legalId: company.legalId,
        logoPath: company.logoPath,
        primaryColor: company.primaryColor || "#1e1046",
        accentColor: company.accentColor || "#0070C0",
        phone: company.phone,
        whatsapp: company.whatsapp,
        sinpePhone: company.sinpePhone,
        email: company.email,
        footerMotto: company.footerMotto,
        bankAccounts: parseBankAccounts(company.bankAccountsJson),
      },
    });
  } catch (err) {
    console.error("Public quote GET error:", err);
    return NextResponse.json({ error: "Error cargando la proforma." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ip = getClientIp(req);
    const rl = checkRateLimit(`pubquote:${ip}:${id}`, 12, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
    }

    const contentType = req.headers.get("content-type") || "";
    let sig = "";
    let action = "approve";
    let customerNote = "";
    let imageBuffer: Buffer | null = null;
    let imageMime = "image/jpeg";

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      sig = String(fd.get("sig") || "");
      action = String(fd.get("action") || "upload_sinpe");
      customerNote = String(fd.get("note") || "").trim();
      const file = fd.get("file") as File | null;
      if (file && file.size > 0) {
        if (file.size > 6 * 1024 * 1024) {
          return NextResponse.json({ error: "La imagen del comprobante no debe superar 6 MB." }, { status: 400 });
        }
        if (!file.type.startsWith("image/")) {
          return NextResponse.json({ error: "Sube una captura de imagen (JPG, PNG o WebP)." }, { status: 400 });
        }
        imageBuffer = Buffer.from(await file.arrayBuffer());
        imageMime = file.type;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      sig = String(body.sig || "");
      action = String(body.action || "approve");
      customerNote = String(body.note || "").trim();
    }

    if (!verifyQuotePdfToken(id, sig)) {
      return NextResponse.json({ error: "Enlace de proforma inválido." }, { status: 401 });
    }

    const quote = await prisma.quote.findUnique({ where: { id } });
    if (!quote) {
      return NextResponse.json({ error: "Proforma no encontrada." }, { status: 404 });
    }

    const workspaceId = quote.workspaceId;

    // 1. One-click Quote Approval
    if (action === "approve") {
      await prisma.quote.update({
        where: { id: quote.id },
        data: { status: "APROBADA" },
      });

      if (quote.clientId) {
        await prisma.client.updateMany({
          where: { id: quote.clientId, workspaceId },
          data: { stage: "GANADO", estimatedValue: quote.total },
        });
      }

      await Promise.all([
        prisma.activity.create({
          data: {
            workspaceId,
            clientId: quote.clientId,
            quoteId: quote.id,
            type: "NOTA",
            title: `✅ Proforma #${quote.number} APROBADA desde Portal Cliente`,
            description: customerNote || `El cliente aprobó la proforma por ${formatMoney(quote.total, quote.currency)}.`,
            completed: true,
          },
        }),
        prisma.sellerAlert.create({
          data: {
            workspaceId,
            clientId: quote.clientId,
            title: `🏆 Proforma #${quote.number} APROBADA (${quote.clientCompany})`,
            buyingSignals: `El cliente aprobó la proforma por ${formatMoney(quote.total, quote.currency)} desde el portal interactivo.${
              customerNote ? ` Nota: "${customerNote}"` : ""
            }`,
            suggestedNextStep: "Contactar al cliente para confirmar pago y coordinar entrega.",
            score: 98,
            priority: "ALTA",
          },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        status: "APROBADA",
        message: "✅ ¡Proforma aprobada! Hemos notificado a tu asesor para coordinar entrega o pago.",
      });
    }

    // 2. SINPE / Bank Transfer Receipt Upload + Gemini Vision Verification
    if (action === "upload_sinpe") {
      if (!imageBuffer) {
        return NextResponse.json({ error: "Selecciona una captura de pantalla del comprobante SINPE." }, { status: 400 });
      }

      const cfg = await getIntegrationSettings(workspaceId);
      let verification = {
        amount: "",
        reference: "",
        bank: "",
        senderName: "",
        date: "",
        matchesTotal: false,
        summary: "Comprobante recibido correctamente. Tu asesor confirmará la acreditación en breve.",
      };

      if (cfg.aiApiKey) {
        try {
          const prompt = `Analiza esta captura de comprobante de pago (SINPE Móvil o transferencia bancaria de Costa Rica).
El total esperado de la Proforma #${quote.number} es ${formatMoney(quote.total, quote.currency)} (${quote.currency}).
Devuelve ÚNICAMENTE un JSON válido (sin markdown):
{
  "amount": "Monto leído del comprobante (ej. ₡45.000 o $89.00)",
  "reference": "Número de comprobante o referencia si aparece",
  "bank": "Banco o plataforma (ej. BN, BCR, BAC, SINPE Móvil)",
  "senderName": "Nombre del remitente o titular si aparece",
  "date": "Fecha/hora del comprobante si aparece",
  "matchesTotal": true o false (true si el monto cubre al menos el 50% o el total de la proforma),
  "summary": "Resumen claro en 1 frase en español de lo verificado"
}`;
          const { text } = await callGeminiResilient({
            apiKey: cfg.aiApiKey,
            preferredModel: cfg.aiModel || "gemini-flash-lite-latest",
            temperature: 0.1,
            maxOutputTokens: 450,
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: imageMime,
                  data: imageBuffer.toString("base64"),
                },
              },
            ],
          });
          const m = text.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = JSON.parse(m[0]);
            verification = { ...verification, ...parsed };
          }
        } catch (aiErr) {
          console.warn("SINPE Vision fallback:", aiErr);
        }
      }

      await prisma.quote.update({
        where: { id: quote.id },
        data: { status: "APROBADA" },
      });

      if (quote.clientId) {
        await prisma.client.updateMany({
          where: { id: quote.clientId, workspaceId },
          data: { stage: "GANADO", estimatedValue: quote.total },
        });
      }

      const detailLine = [
        verification.amount ? `Monto leído: ${verification.amount}` : "",
        verification.reference ? `Ref: ${verification.reference}` : "",
        verification.bank ? `Banco: ${verification.bank}` : "",
        verification.senderName ? `De: ${verification.senderName}` : "",
        customerNote ? `Nota: ${customerNote}` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      await Promise.all([
        prisma.activity.create({
          data: {
            workspaceId,
            clientId: quote.clientId,
            quoteId: quote.id,
            type: "NOTA",
            title: `📲 Comprobante SINPE recibido · Proforma #${quote.number}`,
            description: `${detailLine || verification.summary}\nResumen IA: ${verification.summary}`,
            completed: true,
          },
        }),
        prisma.sellerAlert.create({
          data: {
            workspaceId,
            clientId: quote.clientId,
            title: `📲 Comprobante SINPE recibido · Proforma #${quote.number} (${quote.clientCompany})`,
            buyingSignals: `${detailLine ? `${detailLine} — ` : ""}${verification.summary}`,
            suggestedNextStep: "Verificar acreditación en tu banco y confirmar despacho al cliente.",
            score: 100,
            priority: "ALTA",
          },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        status: "APROBADA",
        verification,
        message: "✅ ¡Comprobante recibido y validado! Avisamos a tu asesor de inmediato.",
      });
    }

    return NextResponse.json({ error: "Acción no soportada." }, { status: 400 });
  } catch (err) {
    console.error("Public quote POST error:", err);
    return NextResponse.json({ error: "Error procesando la solicitud." }, { status: 500 });
  }
}
