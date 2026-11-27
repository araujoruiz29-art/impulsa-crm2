import { NextRequest, NextResponse } from "next/server";
import { getCompanySettings, getIntegrationSettings, parseBankAccounts, prisma } from "@/lib/prisma";
import { getActiveWorkspaceId, getCurrentSession, requireOwnerOrAdmin } from "@/lib/workspace";
import { isMaskedOrEmpty, maskSecret } from "@/lib/security";
import { logAuditEvent } from "@/lib/audit";

function sanitizeIntegrations<T extends Record<string, unknown>>(integ: T) {
  return {
    ...integ,
    smtpPass: maskSecret(String(integ.smtpPass || "")),
    imapPass: maskSecret(String(integ.imapPass || "")),
    metaAccessToken: maskSecret(String(integ.metaAccessToken || "")),
    metaPageAccessToken: maskSecret(String(integ.metaPageAccessToken || "")),
    metaAppSecret: maskSecret(String(integ.metaAppSecret || "")),
    aiApiKey: maskSecret(String(integ.aiApiKey || "")),
    outboundWebhookSecret: maskSecret(String(integ.outboundWebhookSecret || "")),
    publicApiKey: maskSecret(String(integ.publicApiKey || "")),
    feApiKey: maskSecret(String(integ.feApiKey || "")),
  };
}

export async function GET() {
  const session = await getCurrentSession();
  const workspaceId = await getActiveWorkspaceId();
  if (workspaceId.startsWith("__")) {
    return NextResponse.json({ error: "Sin acceso activo a esta empresa." }, { status: 403 });
  }

  const [company, integrations] = await Promise.all([
    getCompanySettings(workspaceId),
    getIntegrationSettings(workspaceId),
  ]);

  return NextResponse.json({
    canEdit: Boolean(
      process.env.CRM_DISABLE_AUTH === "true" ||
        (session && (session.role === "SUPERADMIN" || session.role === "OWNER"))
    ),
    company: {
      ...company,
      bankAccounts: parseBankAccounts(company.bankAccountsJson),
    },
    integrations: sanitizeIntegrations(integrations as unknown as Record<string, unknown>),
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const guard = await requireOwnerOrAdmin();
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
    const workspaceId = guard.workspaceId;
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
          ...(c.publicStoreEnabled !== undefined ? { publicStoreEnabled: Boolean(c.publicStoreEnabled) } : {}),
          ...(c.publicBookingEnabled !== undefined ? { publicBookingEnabled: Boolean(c.publicBookingEnabled) } : {}),
          ...(c.bookingHoursJson !== undefined ? { bookingHoursJson: String(c.bookingHoursJson) } : {}),
          ...(c.roundRobinEnabled !== undefined ? { roundRobinEnabled: Boolean(c.roundRobinEnabled) } : {}),
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
          ...(!isMaskedOrEmpty(i.smtpPass) ? { smtpPass: String(i.smtpPass).trim() } : {}),
          ...(i.smtpFromName !== undefined ? { smtpFromName: String(i.smtpFromName) } : {}),
          ...(i.smtpFromEmail !== undefined ? { smtpFromEmail: String(i.smtpFromEmail) } : {}),
          ...(i.imapHost !== undefined ? { imapHost: String(i.imapHost) } : {}),
          ...(i.imapPort !== undefined ? { imapPort: Number(i.imapPort) || 993 } : {}),
          ...(i.imapSecure !== undefined ? { imapSecure: Boolean(i.imapSecure) } : {}),
          ...(i.imapUser !== undefined ? { imapUser: String(i.imapUser) } : {}),
          ...(!isMaskedOrEmpty(i.imapPass) ? { imapPass: String(i.imapPass).trim() } : {}),
          ...(!isMaskedOrEmpty(i.metaAccessToken) ? { metaAccessToken: String(i.metaAccessToken).trim() } : {}),
          ...(!isMaskedOrEmpty(i.metaPageAccessToken)
            ? { metaPageAccessToken: String(i.metaPageAccessToken).trim() }
            : {}),
          ...(i.metaPhoneNumberId !== undefined ? { metaPhoneNumberId: String(i.metaPhoneNumberId) } : {}),
          ...(i.metaWabaId !== undefined ? { metaWabaId: String(i.metaWabaId) } : {}),
          ...(i.metaPageId !== undefined ? { metaPageId: String(i.metaPageId) } : {}),
          ...(i.metaIgAccountId !== undefined ? { metaIgAccountId: String(i.metaIgAccountId) } : {}),
          ...(i.metaAdAccountId !== undefined ? { metaAdAccountId: String(i.metaAdAccountId) } : {}),
          ...(i.metaVerifyToken !== undefined ? { metaVerifyToken: String(i.metaVerifyToken) } : {}),
          ...(!isMaskedOrEmpty(i.metaAppSecret) ? { metaAppSecret: String(i.metaAppSecret).trim() } : {}),
          ...(i.metaPublicWebhookUrl !== undefined ? { metaPublicWebhookUrl: String(i.metaPublicWebhookUrl) } : {}),
          ...(i.metaAutoReply !== undefined ? { metaAutoReply: Boolean(i.metaAutoReply) } : {}),
          ...(i.aiProvider !== undefined ? { aiProvider: String(i.aiProvider) } : {}),
          ...(!isMaskedOrEmpty(i.aiApiKey) ? { aiApiKey: String(i.aiApiKey).trim() } : {}),
          ...(i.aiModel !== undefined ? { aiModel: String(i.aiModel) } : {}),
          ...(i.aiAutoReplyWhatsapp !== undefined ? { aiAutoReplyWhatsapp: Boolean(i.aiAutoReplyWhatsapp) } : {}),
          ...(i.aiAutoReplyEmail !== undefined ? { aiAutoReplyEmail: Boolean(i.aiAutoReplyEmail) } : {}),
          ...(i.aiGlobalPaused !== undefined ? { aiGlobalPaused: Boolean(i.aiGlobalPaused) } : {}),
          ...(i.aiOnlyNewClients !== undefined ? { aiOnlyNewClients: Boolean(i.aiOnlyNewClients) } : {}),
          ...(i.aiSystemPrompt !== undefined ? { aiSystemPrompt: String(i.aiSystemPrompt) } : {}),
          ...(i.aiKnowledgeBase !== undefined ? { aiKnowledgeBase: String(i.aiKnowledgeBase) } : {}),
          ...(i.visionFoundTemplate !== undefined ? { visionFoundTemplate: String(i.visionFoundTemplate) } : {}),
          ...(i.visionFallbackTemplate !== undefined ? { visionFallbackTemplate: String(i.visionFallbackTemplate) } : {}),
          ...(i.aiVoiceRepliesEnabled !== undefined ? { aiVoiceRepliesEnabled: Boolean(i.aiVoiceRepliesEnabled) } : {}),
          ...(i.aiVoiceName !== undefined ? { aiVoiceName: String(i.aiVoiceName) } : {}),
          ...(i.outboundWebhookUrl !== undefined ? { outboundWebhookUrl: String(i.outboundWebhookUrl).trim() } : {}),
          ...(!isMaskedOrEmpty(i.outboundWebhookSecret)
            ? { outboundWebhookSecret: String(i.outboundWebhookSecret).trim() }
            : {}),
          ...(i.outboundWebhookEvents !== undefined ? { outboundWebhookEvents: String(i.outboundWebhookEvents) } : {}),
          ...(!isMaskedOrEmpty(i.publicApiKey) ? { publicApiKey: String(i.publicApiKey).trim() } : {}),
          ...(i.cardPaymentProvider !== undefined ? { cardPaymentProvider: String(i.cardPaymentProvider) } : {}),
          ...(i.cardPaymentLinkBase !== undefined ? { cardPaymentLinkBase: String(i.cardPaymentLinkBase).trim() } : {}),
          ...(i.feProvider !== undefined ? { feProvider: String(i.feProvider) } : {}),
          ...(i.feApiUrl !== undefined ? { feApiUrl: String(i.feApiUrl).trim() } : {}),
          ...(!isMaskedOrEmpty(i.feApiKey) ? { feApiKey: String(i.feApiKey).trim() } : {}),
          ...(i.weeklyReportEmail !== undefined ? { weeklyReportEmail: String(i.weeklyReportEmail).trim() } : {}),
        },
      });
    }

    await logAuditEvent({
      workspaceId,
      action: "SETTINGS_UPDATED",
      entityType: "Settings",
      entityId: workspaceId,
      summary: "Actualizó configuración de empresa o integraciones.",
    });

    const [company, integrations] = await Promise.all([
      getCompanySettings(workspaceId),
      getIntegrationSettings(workspaceId),
    ]);
    return NextResponse.json({
      ok: true,
      company: { ...company, bankAccounts: parseBankAccounts(company.bankAccountsJson) },
      integrations: sanitizeIntegrations(integrations as unknown as Record<string, unknown>),
    });
  } catch (err) {
    console.error("Save settings error:", err);
    return NextResponse.json({ error: "No se pudo guardar la configuración." }, { status: 500 });
  }
}
