import { NextRequest, NextResponse } from "next/server";
import { getCompanySettings, getIntegrationSettings, parseBankAccounts, prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace";

export async function GET() {
  const workspaceId = await getActiveWorkspaceId();
  const [company, integrations] = await Promise.all([
    getCompanySettings(workspaceId),
    getIntegrationSettings(workspaceId),
  ]);
  return NextResponse.json({
    company: {
      ...company,
      bankAccounts: parseBankAccounts(company.bankAccountsJson),
    },
    integrations,
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const workspaceId = await getActiveWorkspaceId();
    const body = await req.json();

    if (body.company) {
      const c = body.company;
      await prisma.companySettings.upsert({
        where: { id: workspaceId },
        create: { id: workspaceId },
        update: {
          ...(c.companyName !== undefined ? { companyName: String(c.companyName) } : {}),
          ...(c.brandName !== undefined ? { brandName: String(c.brandName) } : {}),
          ...(c.primaryColor !== undefined ? { primaryColor: String(c.primaryColor) } : {}),
          ...(c.accentColor !== undefined ? { accentColor: String(c.accentColor) } : {}),
          ...(c.logoPath !== undefined ? { logoPath: String(c.logoPath) } : {}),
          ...(c.legalId !== undefined ? { legalId: String(c.legalId) } : {}),
          ...(c.address !== undefined ? { address: String(c.address) } : {}),
          ...(c.phone !== undefined ? { phone: String(c.phone) } : {}),
          ...(c.whatsapp !== undefined ? { whatsapp: String(c.whatsapp) } : {}),
          ...(c.sinpePhone !== undefined ? { sinpePhone: String(c.sinpePhone) } : {}),
          ...(c.email !== undefined ? { email: String(c.email) } : {}),
          ...(c.secondaryEmail !== undefined ? { secondaryEmail: String(c.secondaryEmail) } : {}),
          ...(c.billingEmail !== undefined ? { billingEmail: String(c.billingEmail) } : {}),
          ...(c.defaultSeller !== undefined ? { defaultSeller: String(c.defaultSeller) } : {}),
          ...(c.defaultCurrency !== undefined ? { defaultCurrency: String(c.defaultCurrency) } : {}),
          ...(c.defaultTaxRate !== undefined ? { defaultTaxRate: Number(c.defaultTaxRate) } : {}),
          ...(c.defaultTaxMode !== undefined ? { defaultTaxMode: String(c.defaultTaxMode) } : {}),
          ...(c.defaultPaymentTerms !== undefined ? { defaultPaymentTerms: String(c.defaultPaymentTerms) } : {}),
          ...(c.defaultValidity !== undefined ? { defaultValidity: String(c.defaultValidity) } : {}),
          ...(c.nextQuoteNumber !== undefined ? { nextQuoteNumber: Number(c.nextQuoteNumber) } : {}),
          ...(c.footerMotto !== undefined ? { footerMotto: String(c.footerMotto) } : {}),
          ...(Array.isArray(c.bankAccounts) ? { bankAccountsJson: JSON.stringify(c.bankAccounts) } : {}),
        },
      });
    }

    if (body.integrations) {
      const i = body.integrations;
      await prisma.integrationSettings.upsert({
        where: { id: workspaceId },
        create: { id: workspaceId },
        update: {
          ...(i.smtpHost !== undefined ? { smtpHost: String(i.smtpHost) } : {}),
          ...(i.smtpPort !== undefined ? { smtpPort: Number(i.smtpPort) || 465 } : {}),
          ...(i.smtpSecure !== undefined ? { smtpSecure: Boolean(i.smtpSecure) } : {}),
          ...(i.smtpUser !== undefined ? { smtpUser: String(i.smtpUser) } : {}),
          ...(i.smtpPass !== undefined ? { smtpPass: String(i.smtpPass) } : {}),
          ...(i.smtpFromName !== undefined ? { smtpFromName: String(i.smtpFromName) } : {}),
          ...(i.smtpFromEmail !== undefined ? { smtpFromEmail: String(i.smtpFromEmail) } : {}),
          ...(i.imapHost !== undefined ? { imapHost: String(i.imapHost) } : {}),
          ...(i.imapPort !== undefined ? { imapPort: Number(i.imapPort) || 993 } : {}),
          ...(i.imapSecure !== undefined ? { imapSecure: Boolean(i.imapSecure) } : {}),
          ...(i.imapUser !== undefined ? { imapUser: String(i.imapUser) } : {}),
          ...(i.imapPass !== undefined ? { imapPass: String(i.imapPass) } : {}),
          ...(i.metaAccessToken !== undefined ? { metaAccessToken: String(i.metaAccessToken) } : {}),
          ...(i.metaPhoneNumberId !== undefined ? { metaPhoneNumberId: String(i.metaPhoneNumberId) } : {}),
          ...(i.metaWabaId !== undefined ? { metaWabaId: String(i.metaWabaId) } : {}),
          ...(i.metaPageId !== undefined ? { metaPageId: String(i.metaPageId) } : {}),
          ...(i.metaIgAccountId !== undefined ? { metaIgAccountId: String(i.metaIgAccountId) } : {}),
          ...(i.metaAdAccountId !== undefined ? { metaAdAccountId: String(i.metaAdAccountId) } : {}),
          ...(i.metaVerifyToken !== undefined ? { metaVerifyToken: String(i.metaVerifyToken) } : {}),
          ...(i.metaAppSecret !== undefined ? { metaAppSecret: String(i.metaAppSecret) } : {}),
          ...(i.metaPublicWebhookUrl !== undefined ? { metaPublicWebhookUrl: String(i.metaPublicWebhookUrl) } : {}),
          ...(i.metaAutoReply !== undefined ? { metaAutoReply: Boolean(i.metaAutoReply) } : {}),
          ...(i.aiProvider !== undefined ? { aiProvider: String(i.aiProvider) } : {}),
          ...(i.aiApiKey !== undefined ? { aiApiKey: String(i.aiApiKey) } : {}),
          ...(i.aiModel !== undefined ? { aiModel: String(i.aiModel) } : {}),
          ...(i.aiAutoReplyWhatsapp !== undefined ? { aiAutoReplyWhatsapp: Boolean(i.aiAutoReplyWhatsapp) } : {}),
          ...(i.aiAutoReplyEmail !== undefined ? { aiAutoReplyEmail: Boolean(i.aiAutoReplyEmail) } : {}),
          ...(i.aiSystemPrompt !== undefined ? { aiSystemPrompt: String(i.aiSystemPrompt) } : {}),
          ...(i.aiKnowledgeBase !== undefined ? { aiKnowledgeBase: String(i.aiKnowledgeBase) } : {}),
          ...(i.visionFoundTemplate !== undefined ? { visionFoundTemplate: String(i.visionFoundTemplate) } : {}),
          ...(i.visionFallbackTemplate !== undefined ? { visionFallbackTemplate: String(i.visionFallbackTemplate) } : {}),
        },
      });
    }

    const [company, integrations] = await Promise.all([
      getCompanySettings(workspaceId),
      getIntegrationSettings(workspaceId),
    ]);
    return NextResponse.json({
      ok: true,
      company: { ...company, bankAccounts: parseBankAccounts(company.bankAccountsJson) },
      integrations,
    });
  } catch (err) {
    console.error("Save settings error:", err);
    return NextResponse.json({ error: "No se pudo guardar la configuración." }, { status: 500 });
  }
}
