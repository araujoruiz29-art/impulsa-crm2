import { PrismaClient } from "@prisma/client";
import { getActiveWorkspaceId } from "./workspace";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveRuntimeDbUrl(): string | undefined {
  const candidates = [
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL,
    process.env.STORAGE_POSTGRES_URL,
    process.env.STORAGE_DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.PRISMA_DATABASE_URL,
  ];
  for (const val of candidates) {
    if (val && (val.startsWith("postgres://") || val.startsWith("postgresql://"))) {
      return val;
    }
  }
  for (const val of Object.values(process.env)) {
    if (val && (val.startsWith("postgres://") || val.startsWith("postgresql://"))) {
      return val;
    }
  }
  for (const val of Object.values(process.env)) {
    if (val && val.startsWith("prisma+postgres://")) {
      return val;
    }
  }
  return process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL;
}

const runtimeDbUrl = resolveRuntimeDbUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(runtimeDbUrl ? { datasources: { db: { url: runtimeDbUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export interface BankAccount {
  bank: string;
  accountNumber: string;
  iban: string;
}

export async function getCompanySettings(explicitWorkspaceId?: string) {
  const workspaceId = explicitWorkspaceId || (await getActiveWorkspaceId());
  let settings = await prisma.companySettings.findUnique({
    where: { id: workspaceId },
  });
  if (!settings) {
    if (workspaceId === "default") {
      settings = await prisma.companySettings.create({
        data: {
          id: "default",
          ownerUserId: "superadmin",
          bankAccountsJson: JSON.stringify([
            {
              bank: "Banco Nacional de Costa Rica (BN)",
              accountNumber: "100-01-012-009956-0",
              iban: "CR93015101210010099565",
            },
            {
              bank: "Banco de Costa Rica (BCR)",
              accountNumber: "215-0009236-3",
              iban: "CR82015201215000923631",
            },
            {
              bank: "Banco BAC",
              accountNumber: "917581761",
              iban: "CR19010200009175817612",
            },
            {
              bank: "Banco Davivienda",
              accountNumber: "",
              iban: "CR65010406940300320211",
            },
          ]),
        },
      });
    } else {
      const now = new Date();
      return {
        id: workspaceId,
        ownerUserId: "",
        companyName: "Mi Empresa",
        brandName: "Mi Empresa",
        primaryColor: "#22115d",
        accentColor: "#0070C0",
        legalId: "",
        address: "",
        phone: "",
        whatsapp: "",
        sinpePhone: "",
        email: "",
        secondaryEmail: "",
        billingEmail: "",
        defaultSeller: "Administrador",
        defaultCurrency: "CRC",
        defaultTaxRate: 0.13,
        defaultTaxMode: "IVA_INCLUIDO",
        defaultPaymentTerms: "CONTADO",
        defaultValidity: "30 días",
        nextQuoteNumber: 1001,
        footerMotto: "Gracias por su preferencia",
        bankAccountsJson: "[]",
        logoPath: "",
        sinpeLogoPath: "",
        createdAt: now,
        updatedAt: now,
      };
    }
  }
  return settings;
}

export async function getIntegrationSettings(explicitWorkspaceId?: string) {
  const workspaceId = explicitWorkspaceId || (await getActiveWorkspaceId());
  let settings = await prisma.integrationSettings.findUnique({
    where: { id: workspaceId },
  });
  if (!settings) {
    settings = await prisma.integrationSettings.create({
      data: { id: workspaceId },
    });
  }
  return settings;
}

export function parseBankAccounts(json: string): BankAccount[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}
