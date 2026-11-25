import fs from "node:fs";
import path from "node:path";

// Automatically switches Prisma datasource provider between SQLite (local PC)
// and PostgreSQL (Vercel + Neon/Supabase) based on DATABASE_URL.
const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const isPostgres = dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");

let schema = fs.readFileSync(schemaPath, "utf8");
const targetProvider = isPostgres ? "postgresql" : "sqlite";

if (schema.includes('provider = "sqlite"') && isPostgres) {
  schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"');
  fs.writeFileSync(schemaPath, schema, "utf8");
  console.log("[prepare-db] Switched Prisma datasource provider -> postgresql");
} else if (schema.includes('provider = "postgresql"') && !isPostgres) {
  schema = schema.replace('provider = "postgresql"', 'provider = "sqlite"');
  fs.writeFileSync(schemaPath, schema, "utf8");
  console.log("[prepare-db] Switched Prisma datasource provider -> sqlite");
} else {
  console.log(`[prepare-db] Prisma datasource provider already matches: ${targetProvider}`);
}
