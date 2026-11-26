import fs from "fs";
import path from "path";
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { formatDateCR, formatNumberCR } from "./format";
import { BankAccount, getCompanySettings, parseBankAccounts } from "./prisma";

export interface QuotePdfData {
  workspaceId?: string;
  number: number;
  issueDate: Date | string;
  clientCode: string;
  clientCompany: string;
  clientContact: string;
  clientAddress: string;
  clientPhone: string;
  clientEmail: string;
  seller: string;
  jobTitle: string;
  paymentTerms: string;
  validity: string;
  currency: string;
  taxMode: string;
  taxRate: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  notes?: string;
  items: {
    quantity: number;
    title: string;
    description: string;
    unitPrice: number;
    lineTotal: number;
  }[];
}

// Keep strings safe for PDF StandardFonts WinAnsi encoding
function safePdfText(input: string): string {
  return (input || "")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/₡/g, "CRC ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const result: string[] = [];
  const paragraphs = (text || "").split(/\r?\n/);
  for (const para of paragraphs) {
    const clean = safePdfText(para).trim();
    if (!clean) continue;
    const words = clean.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) result.push(line);
        line = word;
      }
    }
    if (line) result.push(line);
  }
  return result;
}

// Draws authentic Costa Rican Colón symbol (₡) as vector strokes + formatted amount right-aligned
function drawMoneyRightAligned(
  page: PDFPage,
  amount: number,
  currency: string,
  rightX: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0.12, 0.16, 0.22)
) {
  const numStr = currency === "USD"
    ? `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : formatNumberCR(amount);

  if (currency === "USD") {
    const w = font.widthOfTextAtSize(numStr, size);
    page.drawText(numStr, { x: rightX - w, y, size, font, color });
    return;
  }

  const numW = font.widthOfTextAtSize(numStr, size);
  const symbolW = font.widthOfTextAtSize("C", size) + 2;
  const startX = rightX - numW - symbolW;

  // Draw C + double diagonal/vertical strokes for Colón (₡)
  page.drawText("C", { x: startX, y, size, font, color });
  const strokeBottom = y - 1.2;
  const strokeTop = y + size * 0.78;
  const cMid = startX + font.widthOfTextAtSize("C", size) * 0.45;
  page.drawLine({
    start: { x: cMid - 1.3, y: strokeBottom },
    end: { x: cMid - 0.5, y: strokeTop },
    thickness: 0.7,
    color,
  });
  page.drawLine({
    start: { x: cMid + 1.1, y: strokeBottom },
    end: { x: cMid + 1.9, y: strokeTop },
    thickness: 0.7,
    color,
  });

  page.drawText(numStr, { x: startX + symbolW, y, size, font, color });
}

export async function generateProformaPdf(quote: QuotePdfData): Promise<Uint8Array> {
  const company = await getCompanySettings(quote.workspaceId);
  const bankAccounts: BankAccount[] = parseBankAccounts(company.bankAccountsJson);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  // Caminante brand palette from 1408-MEP.xlsm
  const bluePrimary = rgb(0.0, 0.439, 0.753); // #0070C0
  const blueDark = rgb(0.0, 0.34, 0.62);
  const rowAlt = rgb(0.851, 0.882, 0.949); // #D9E1F2
  const textDark = rgb(0.12, 0.16, 0.22);
  const textMuted = rgb(0.42, 0.46, 0.52);
  const redAccent = rgb(0.75, 0.05, 0.05);
  const white = rgb(1, 1, 1);

  const marginX = 48;
  const contentW = width - marginX * 2;
  let y = height - 42;

  // 1. Logo (top-left) — supports Data URI upload (PNG/JPG), remote HTTPS URL, or /public path
  let logoEmbedded = false;
  const rawLogo = (company.logoPath || "").trim();
  const logoCandidate = rawLogo || (company.id === "default" ? "/brand/image1.png" : "");
  if (logoCandidate) {
    try {
      let logoBytes: Uint8Array | null = null;
      let isJpg = false;

      if (logoCandidate.startsWith("data:image/")) {
        const match = logoCandidate.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
        if (match) {
          isJpg = match[1].toLowerCase() !== "png";
          logoBytes = Uint8Array.from(Buffer.from(match[2], "base64"));
        }
      } else if (/^https?:\/\//i.test(logoCandidate)) {
        const resp = await fetch(logoCandidate);
        if (resp.ok) {
          const ct = (resp.headers.get("content-type") || "").toLowerCase();
          isJpg = ct.includes("jpeg") || ct.includes("jpg") || /\.jpe?g($|\?)/i.test(logoCandidate);
          logoBytes = new Uint8Array(await resp.arrayBuffer());
        }
      } else {
        const logoRel = logoCandidate.replace(/^\//, "");
        const logoAbs = path.join(process.cwd(), "public", logoRel);
        if (fs.existsSync(logoAbs)) {
          isJpg = /\.jpe?g$/i.test(logoAbs);
          logoBytes = fs.readFileSync(logoAbs);
        }
      }

      if (logoBytes) {
        const logoImg = isJpg ? await pdfDoc.embedJpg(logoBytes) : await pdfDoc.embedPng(logoBytes);
        const maxW = 195;
        const maxH = 44;
        const scale = Math.min(maxW / logoImg.width, maxH / logoImg.height);
        const targetW = logoImg.width * scale;
        const targetH = logoImg.height * scale;
        page.drawImage(logoImg, {
          x: marginX,
          y: y - targetH + 8,
          width: targetW,
          height: targetH,
        });
        logoEmbedded = true;
      }
    } catch {
      logoEmbedded = false;
    }
  }
  if (!logoEmbedded) {
    page.drawText(safePdfText(company.brandName), {
      x: marginX,
      y: y - 18,
      size: 18,
      font: fontBold,
      color: bluePrimary,
    });
  }

  // Title "Factura Proforma" (top-right)
  const titleText = "Factura Proforma";
  const titleW = fontBold.widthOfTextAtSize(titleText, 20);
  page.drawText(titleText, {
    x: width - marginX - titleW,
    y: y - 16,
    size: 20,
    font: fontBold,
    color: rgb(0.35, 0.44, 0.54),
  });

  // Top divider line
  y -= 40;
  page.drawLine({
    start: { x: marginX, y },
    end: { x: width - marginX, y },
    thickness: 1.5,
    color: bluePrimary,
  });

  // 2. Company info (left) + Document meta (right)
  y -= 15;
  page.drawText(safePdfText(company.companyName), {
    x: marginX,
    y,
    size: 10,
    font: fontBold,
    color: textDark,
  });

  const metaLabelX = width - marginX - 155;
  const metaValRightX = width - marginX - 8;

  const drawMetaRow = (label: string, val: string, rowY: number, isRed = false) => {
    const lw = fontBold.widthOfTextAtSize(label, 9);
    page.drawText(label, {
      x: metaLabelX + 68 - lw,
      y: rowY,
      size: 9,
      font: fontBold,
      color: rgb(0.28, 0.36, 0.46),
    });
    const vw = fontBold.widthOfTextAtSize(val, isRed ? 10 : 9.5);
    page.drawText(val, {
      x: metaValRightX - vw,
      y: rowY,
      size: isRed ? 10 : 9.5,
      font: fontBold,
      color: isRed ? redAccent : textDark,
    });
  };

  drawMetaRow("Fecha:", formatDateCR(quote.issueDate), y);

  y -= 13;
  page.drawText(safePdfText(company.legalId), { x: marginX, y, size: 8.8, font: fontRegular, color: textMuted });
  drawMetaRow("N.° de factura:", String(quote.number), y, true);

  y -= 13;
  page.drawText(safePdfText(company.address), { x: marginX, y, size: 8.8, font: fontRegular, color: textMuted });

  y -= 13;
  page.drawText(
    safePdfText(`Tel: ${company.phone} / Whatsapp: ${company.whatsapp}`),
    { x: marginX, y, size: 8.8, font: fontBold, color: blueDark }
  );
  drawMetaRow("Id. del cliente:", safePdfText(quote.clientCode || ""), y);

  y -= 7;
  page.drawLine({
    start: { x: marginX, y },
    end: { x: width - marginX, y },
    thickness: 1.5,
    color: bluePrimary,
  });

  // 3. Client Details
  const clientRows: [string, string, boolean][] = [
    ["Para:", quote.clientCompany, true],
    ["Contacto:", quote.clientContact, false],
    ["Dirección:", quote.clientAddress, false],
    ["Tel.:", quote.clientPhone, true],
    ["Correo:", quote.clientEmail, false],
  ];

  y -= 14;
  for (const [label, value, bold] of clientRows) {
    const lw = fontBold.widthOfTextAtSize(label, 8.5);
    page.drawText(safePdfText(label), {
      x: marginX + 54 - lw,
      y,
      size: 8.5,
      font: fontBold,
      color: rgb(0.24, 0.33, 0.44),
    });
    page.drawText(safePdfText(value || "-"), {
      x: marginX + 60,
      y,
      size: 8.5,
      font: bold ? fontBold : fontRegular,
      color: label === "Correo:" ? blueDark : textDark,
    });
    y -= 12.5;
  }

  // 4. Commercial metadata bar (Vendedor | Trabajo | Condiciones de pago | Fecha de vencimiento)
  y -= 4;
  const metaCols = [
    { label: "Vendedor", val: quote.seller || company.defaultSeller, w: 92 },
    { label: "Trabajo", val: quote.jobTitle || "-", w: 194 },
    { label: "Condiciones de pago", val: quote.paymentTerms || company.defaultPaymentTerms, w: 120 },
    { label: "Fecha de vencimiento", val: quote.validity || company.defaultValidity, w: contentW - 406 },
  ];

  const barH = 15;
  let colX = marginX;
  for (const col of metaCols) {
    page.drawRectangle({ x: colX, y: y - barH, width: col.w - 2, height: barH, color: bluePrimary });
    const tw = fontBold.widthOfTextAtSize(col.label, 8.2);
    page.drawText(safePdfText(col.label), {
      x: colX + (col.w - 2 - tw) / 2,
      y: y - 10.5,
      size: 8.2,
      font: fontBold,
      color: white,
    });
    colX += col.w;
  }

  y -= barH + 1;
  colX = marginX;
  for (const col of metaCols) {
    page.drawRectangle({ x: colX, y: y - barH, width: col.w - 2, height: barH, color: rowAlt });
    const txt = safePdfText(col.val).slice(0, 38);
    const tw = fontRegular.widthOfTextAtSize(txt, 8.2);
    page.drawText(txt, {
      x: colX + (col.w - 2 - tw) / 2,
      y: y - 10.5,
      size: 8.2,
      font: fontRegular,
      color: textDark,
    });
    colX += col.w;
  }

  // 5. Line Items Table (Cant. | Descripción | Precio por unidad | Total de línea)
  y -= barH + 12;
  const colCantW = 54;
  const colDescW = 246;
  const colPriceW = 104;
  const colTotalW = contentW - colCantW - colDescW - colPriceW;

  const itemHeaders = [
    { label: "Cant.", w: colCantW },
    { label: "Descripción", w: colDescW },
    { label: "Precio por unidad", w: colPriceW },
    { label: "Total de línea", w: colTotalW },
  ];

  colX = marginX;
  for (const h of itemHeaders) {
    page.drawRectangle({ x: colX, y: y - barH, width: h.w - 2, height: barH, color: bluePrimary });
    const tw = fontBold.widthOfTextAtSize(h.label, 8.4);
    page.drawText(safePdfText(h.label), {
      x: colX + (h.w - 2 - tw) / 2,
      y: y - 10.5,
      size: 8.4,
      font: fontBold,
      color: white,
    });
    colX += h.w;
  }

  y -= barH + 2;

  // Flatten quote items into visual lines (matching Excel style where extra specs flow cleanly into subsequent rows)
  interface VisualRow {
    qty?: string;
    desc: string;
    isTitle?: boolean;
    unitPrice?: number;
    lineTotal?: number;
  }

  const visualRows: VisualRow[] = [];
  for (const item of quote.items) {
    const titleLines = wrapText(item.title, fontBold, 8.3, colDescW - 12);
    const descLines = wrapText(item.description || "", fontRegular, 8.0, colDescW - 12);
    visualRows.push({
      qty: String(item.quantity),
      desc: titleLines[0] || safePdfText(item.title),
      isTitle: true,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    });
    for (let i = 1; i < titleLines.length; i++) {
      visualRows.push({ desc: titleLines[i], isTitle: true });
    }
    for (const d of descLines) {
      visualRows.push({ desc: d, isTitle: false });
    }
  }

  const minRows = 16;
  const maxRows = 18;
  const totalDisplayRows = Math.min(maxRows, Math.max(minRows, visualRows.length));
  const rowH = 16.5;

  for (let i = 0; i < totalDisplayRows; i++) {
    const row = visualRows[i];
    const isShaded = i % 2 === 1;
    const bgColor = isShaded ? rowAlt : rgb(0.985, 0.99, 1);

    let rx = marginX;
    for (const h of itemHeaders) {
      page.drawRectangle({
        x: rx,
        y: y - rowH,
        width: h.w - 2,
        height: rowH - 1.5,
        color: bgColor,
      });
      rx += h.w;
    }

    if (row) {
      const textY = y - rowH + 4.5;
      if (row.qty) {
        const qw = fontRegular.widthOfTextAtSize(row.qty, 8.3);
        page.drawText(row.qty, {
          x: marginX + (colCantW - 2 - qw) / 2,
          y: textY,
          size: 8.3,
          font: fontRegular,
          color: textDark,
        });
      }
      if (row.desc) {
        page.drawText(row.desc, {
          x: marginX + colCantW + 5,
          y: textY,
          size: row.isTitle ? 8.3 : 8.0,
          font: row.isTitle ? fontBold : fontRegular,
          color: textDark,
        });
      }
      if (row.unitPrice !== undefined) {
        drawMoneyRightAligned(
          page,
          row.unitPrice,
          quote.currency,
          marginX + colCantW + colDescW + colPriceW - 8,
          textY,
          fontRegular,
          8.3,
          textDark
        );
      }
      if (row.lineTotal !== undefined) {
        drawMoneyRightAligned(
          page,
          row.lineTotal,
          quote.currency,
          marginX + contentW - 8,
          textY,
          fontRegular,
          8.3,
          textDark
        );
      }
    }
    y -= rowH;
  }

  // 6. Totals (right side) & Bank Accounts / Payment Info (left side)
  const footerTopY = y - 10;

  // Left: Contact & Bank Accounts (cleanly rendered, editable from Settings)
  let ly = footerTopY;
  const col1X = marginX;
  const col2X = marginX + 165;

  page.drawText("Factura Electrónica:", { x: col1X, y: ly, size: 7.5, font: fontItalic, color: blueDark });
  page.drawText("Teléfono:", { x: col2X, y: ly, size: 7.5, font: fontBold, color: blueDark });
  ly -= 9.5;
  page.drawText(safePdfText(company.billingEmail), { x: col1X, y: ly, size: 7.8, font: fontBoldItalic, color: bluePrimary });
  page.drawText(safePdfText(company.phone), { x: col2X, y: ly, size: 8.2, font: fontBoldItalic, color: bluePrimary });
  ly -= 10.5;
  page.drawText("Correo:", { x: col1X, y: ly, size: 7.5, font: fontItalic, color: blueDark });
  page.drawText("Celular (Sinpe Móvil):", { x: col2X, y: ly, size: 7.5, font: fontBold, color: blueDark });
  ly -= 9.5;
  page.drawText(safePdfText(company.email), { x: col1X, y: ly, size: 7.8, font: fontBoldItalic, color: bluePrimary });
  page.drawText(safePdfText(company.sinpePhone), { x: col2X, y: ly, size: 8.2, font: fontBoldItalic, color: bluePrimary });

  ly -= 14;
  // Two columns of bank accounts
  const leftBanks = bankAccounts.slice(0, 2);
  const rightBanks = bankAccounts.slice(2, 4);

  let bly = ly;
  for (const b of leftBanks) {
    page.drawText(safePdfText(b.bank), { x: col1X, y: bly, size: 7.4, font: fontBoldItalic, color: bluePrimary });
    bly -= 9;
    if (b.accountNumber) {
      page.drawText(safePdfText(`Cuenta corriente: ${b.accountNumber}`), { x: col1X, y: bly, size: 6.8, font: fontRegular, color: blueDark });
      bly -= 8.5;
    }
    if (b.iban) {
      page.drawText(safePdfText(`Cuenta IBAN: ${b.iban}`), { x: col1X, y: bly, size: 6.8, font: fontRegular, color: blueDark });
      bly -= 11;
    }
  }

  let bry = ly;
  for (const b of rightBanks) {
    page.drawText(safePdfText(b.bank), { x: col2X, y: bry, size: 7.4, font: fontBoldItalic, color: bluePrimary });
    bry -= 9;
    if (b.accountNumber) {
      page.drawText(safePdfText(`Cuenta corriente: ${b.accountNumber}`), { x: col2X, y: bry, size: 6.8, font: fontRegular, color: blueDark });
      bry -= 8.5;
    }
    if (b.iban) {
      page.drawText(safePdfText(`Cuenta IBAN: ${b.iban}`), { x: col2X, y: bry, size: 6.8, font: fontRegular, color: blueDark });
      bry -= 11;
    }
  }

  // Right: Totals box
  const totalBoxX = marginX + colCantW + colDescW + colPriceW;
  const totalBoxW = colTotalW - 2;
  let ty = footerTopY - 4;

  const drawTotalLine = (label: string, val: number, bold = false) => {
    const boxH = 17;
    page.drawRectangle({ x: totalBoxX, y: ty - 4, width: totalBoxW, height: boxH, color: rowAlt });
    const lw = (bold ? fontBold : fontBold).widthOfTextAtSize(label, bold ? 9.5 : 8.5);
    page.drawText(safePdfText(label), {
      x: totalBoxX - lw - 8,
      y: ty + 1,
      size: bold ? 9.5 : 8.5,
      font: fontBold,
      color: textDark,
    });
    drawMoneyRightAligned(
      page,
      val,
      quote.currency,
      totalBoxX + totalBoxW - 6,
      ty + 1,
      bold ? fontBold : fontRegular,
      bold ? 9.5 : 8.5,
      textDark
    );
    ty -= 21;
  };

  drawTotalLine("Subtotal", quote.subtotal, false);

  if (quote.discountAmount > 0) {
    drawTotalLine("Descuento", -quote.discountAmount, false);
  }

  if (quote.taxMode === "DESGLOSADO") {
    drawTotalLine(`IVA (${Math.round(quote.taxRate * 100)}%)`, quote.taxAmount, false);
  }

  drawTotalLine("Total", quote.total, true);

  const taxNote =
    quote.taxMode === "IVA_INCLUIDO"
      ? "* Precios incluyen IVA 13%"
      : quote.taxMode === "EXONERADO"
      ? "* Proforma exonerada de IVA"
      : "* IVA 13% desglosado";
  const tnw = fontItalic.widthOfTextAtSize(taxNote, 7.2);
  page.drawText(taxNote, {
    x: marginX + contentW - tnw - 2,
    y: ty + 8,
    size: 7.2,
    font: fontItalic,
    color: textMuted,
  });

  if (quote.notes) {
    const noteLines = wrapText(`Notas: ${quote.notes}`, fontRegular, 7.2, contentW);
    let ny = Math.min(bly, bry, ty) - 4;
    for (const nl of noteLines.slice(0, 2)) {
      page.drawText(nl, { x: marginX, y: ny, size: 7.2, font: fontRegular, color: textMuted });
      ny -= 9;
    }
  }

  // 7. Bottom Blue Motto Banner + Contact Emails
  const bannerY = 58;
  const bannerH = 20;
  page.drawRectangle({ x: marginX, y: bannerY, width: contentW, height: bannerH, color: bluePrimary });
  const motto = safePdfText(company.footerMotto);
  const mw = fontBold.widthOfTextAtSize(motto, 10.5);
  page.drawText(motto, {
    x: marginX + (contentW - mw) / 2,
    y: bannerY + 6,
    size: 10.5,
    font: fontBold,
    color: white,
  });

  const emailsLine = safePdfText(`${company.email} // ${company.secondaryEmail}`);
  const ew = fontBold.widthOfTextAtSize(emailsLine, 9);
  page.drawText(emailsLine, {
    x: marginX + (contentW - ew) / 2,
    y: bannerY - 14,
    size: 9,
    font: fontBold,
    color: bluePrimary,
  });

  return pdfDoc.save();
}
