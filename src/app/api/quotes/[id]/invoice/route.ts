import { NextRequest, NextResponse } from "next/server";
import { getCompanySettings, getIntegrationSettings, prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { isSafeExternalHttpsUrl } from "@/lib/security";
import { logAuditEvent } from "@/lib/audit";
import { emitOutboundWebhook } from "@/lib/outbound-webhook";

// #12: Card Payment Link generator (Tilopay / Onvo / Stripe / Custom) + Costa Rica Electronic Invoice (Hacienda 4.4)
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "fe_44"); // "card_link" | "fe_44"

    const [quote, company, cfg] = await Promise.all([
      prisma.quote.findFirst({
        where: { id, workspaceId },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      }),
      getCompanySettings(workspaceId),
      getIntegrationSettings(workspaceId),
    ]);

    if (!quote) {
      return NextResponse.json({ error: "Proforma no encontrada." }, { status: 404 });
    }

    // A. Generate or save Card Payment Link (Tilopay / Onvo / BAC Compra-Click / Stripe)
    if (action === "card_link") {
      const customUrl = String(body.customUrl || "").trim();
      const base = (cfg.cardPaymentLinkBase || "").trim();
      const balance = Math.max(0, Number((quote.total - (quote.paidAmount || 0)).toFixed(2))) || quote.total;

      let finalUrl = customUrl;
      if (!finalUrl && base) {
        const sep = base.includes("?") ? "&" : "?";
        finalUrl = `${base}${sep}amount=${encodeURIComponent(String(balance))}&currency=${encodeURIComponent(
          quote.currency
        )}&order=PROFORMA-${quote.number}`;
      }

      if (!finalUrl || !isSafeExternalHttpsUrl(finalUrl)) {
        return NextResponse.json(
          {
            error:
              "Configura tu URL base de Tilopay / Onvo / Compra-Click en Conexiones → Vanguardia, o pega un enlace HTTPS válido.",
          },
          { status: 400 }
        );
      }

      await prisma.quote.update({
        where: { id: quote.id },
        data: { paymentLinkUrl: finalUrl },
      });

      await logAuditEvent({
        workspaceId,
        action: "PAYMENT_LINK_SET",
        entityType: "Quote",
        entityId: quote.id,
        summary: `Generó link de pago con tarjeta para Proforma #${quote.number}`,
      });

      return NextResponse.json({
        ok: true,
        paymentLinkUrl: finalUrl,
        message: "💳 Enlace de pago con tarjeta guardado y visible en el Portal del Cliente.",
      });
    }

    // B. Emit Costa Rica Hacienda 4.4 Electronic Invoice Payload (via configured GTI / Alanube / FinanzaPro / Custom API)
    const now = new Date();
    const consecutivo = `0010000101${String(quote.number).padStart(10, "0")}`;
    const randomSec = String(Math.floor(10000000 + Math.random() * 89999999));
    const ddmmyy =
      String(now.getDate()).padStart(2, "0") +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getFullYear()).slice(-2);
    const cedClean = (company.legalId || "3101000000").replace(/\D/g, "").padStart(12, "0").slice(0, 12);
    const clave50 = `506${ddmmyy}${cedClean}${consecutivo}1${randomSec}`;

    const hacienda44Payload = {
      version: "4.4",
      tipoDocumento: "01", // Factura Electrónica
      clave: clave50,
      numeroConsecutivo: consecutivo,
      fechaEmision: now.toISOString(),
      emisor: {
        nombre: company.companyName,
        nombreComercial: company.brandName,
        identificacion: company.legalId,
        correoElectronico: company.billingEmail || company.email,
        telefono: company.phone,
      },
      receptor: {
        nombre: quote.clientCompany,
        contacto: quote.clientContact,
        correoElectronico: quote.clientEmail,
        telefono: quote.clientPhone,
      },
      condicionVenta: quote.paymentTerms === "CREDITO" ? "02" : "01",
      moneda: quote.currency === "USD" ? "USD" : "CRC",
      detalleServicio: quote.items.map((it, idx) => ({
        numeroLinea: idx + 1,
        cantidad: it.quantity,
        detalle: `${it.title}${it.description ? ` - ${it.description}` : ""}`,
        precioUnitario: it.unitPrice,
        montoTotalLinea: it.lineTotal,
        tarifaIva: quote.taxMode === "EXONERADO" ? 0 : Math.round(quote.taxRate * 100),
      })),
      resumenFactura: {
        subtotal: quote.subtotal,
        descuento: quote.discountAmount,
        impuesto: quote.taxAmount,
        totalComprobante: quote.total,
      },
    };

    let feStatus = "BORRADOR_4_4";
    let providerMsg =
      "JSON oficial Hacienda 4.4 preparado y clave asignada. Configura tu proveedor (GTI / Alanube / FinanzaPro) en Conexiones → Vanguardia para timbrado directo.";

    if (cfg.feApiUrl && isSafeExternalHttpsUrl(cfg.feApiUrl)) {
      try {
        const res = await fetch(cfg.feApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(cfg.feApiKey ? { Authorization: `Bearer ${cfg.feApiKey}` } : {}),
          },
          body: JSON.stringify(hacienda44Payload),
        });
        const resData = await res.json().catch(() => ({}));
        if (res.ok) {
          feStatus = "ENVIADA_HACIENDA";
          providerMsg = `🧾 Factura Electrónica 4.4 enviada a ${cfg.feProvider || "emisor FE"} (Consecutivo ${
            resData.consecutivo || consecutivo
          }).`;
        } else {
          feStatus = "ERROR_EMISOR";
          providerMsg = resData?.error || resData?.message || `Emisor FE respondió HTTP ${res.status}.`;
        }
      } catch (e) {
        feStatus = "ERROR_CONEXION";
        providerMsg = e instanceof Error ? e.message : "No se pudo conectar con el emisor FE.";
      }
    }

    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        feNumber: consecutivo,
        feKey: clave50,
        feStatus,
      },
    });

    await logAuditEvent({
      workspaceId,
      action: "FE_44_EMITTED",
      entityType: "Quote",
      entityId: quote.id,
      summary: `Factura Electrónica CR 4.4 (${feStatus}) · Proforma #${quote.number} · Consecutivo ${consecutivo}`,
    });

    emitOutboundWebhook({
      workspaceId,
      event: "INVOICE_EMITTED",
      payload: {
        quoteId: quote.id,
        quoteNumber: quote.number,
        feStatus,
        feNumber: consecutivo,
        feKey: clave50,
        hacienda44: hacienda44Payload,
      },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      feNumber: consecutivo,
      feKey: clave50,
      feStatus,
      message: providerMsg,
      hacienda44Payload,
    });
  } catch (err) {
    console.error("Quote invoice/card error:", err);
    return NextResponse.json({ error: "Error procesando pago o facturación." }, { status: 500 });
  }
}
