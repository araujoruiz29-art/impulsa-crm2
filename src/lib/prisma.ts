import { PrismaClient } from "@prisma/client";
import { getActiveWorkspaceId } from "./workspace";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
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
    // Fallback to default if cookie pointed to deleted workspace
    settings = await prisma.companySettings.findUnique({ where: { id: "default" } });
  }
  if (!settings) {
    settings = await prisma.companySettings.create({
      data: {
        id: "default",
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
