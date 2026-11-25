import fs from "node:fs";
import path from "node:path";

// Automatically detects SQLite (local) vs PostgreSQL (Vercel / Prisma Postgres / Neon / Supabase)
// and binds prisma/schema.prisma to whichever env variable Vercel actually injected.
const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");

const preferredDirectOrder = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_PRISMA_URL",
  "STORAGE_POSTGRES_URL",
  "STORAGE_DATABASE_URL",
  "PRISMA_DATABASE_URL",
];

function findDbEnvVar() {
  // 1. Prefer direct postgres:// or postgresql:// URLs (work cleanly with prisma db push without Accelerate)
  for (const name of preferredDirectOrder) {
    const val = process.env[name];
    if (val && (val.startsWith("postgres://") || val.startsWith("postgresql://"))) {
      return { name, val, isPostgres: true };
    }
  }
  // 2. Scan all env vars for any postgres:// or postgresql:// URL
  for (const [name, val] of Object.entries(process.env)) {
    if (val && (val.startsWith("postgres://") || val.startsWith("postgresql://"))) {
      return { name, val, isPostgres: true };
    }
  }
  // 3. Fallback to prisma+postgres:// if only that exists
  for (const name of preferredDirectOrder) {
    const val = process.env[name];
    if (val && val.startsWith("prisma+postgres://")) {
      return { name, val, isPostgres: true };
    }
  }
  // 4. Local SQLite default
  return { name: "DATABASE_URL", val: process.env.DATABASE_URL || "file:./dev.db", isPostgres: false };
}

const found = findDbEnvVar();
let schema = fs.readFileSync(schemaPath, "utf8");

if (found.isPostgres) {
  schema = schema.replace(/provider\s*=\s*"(?:sqlite|postgresql)"/, 'provider = "postgresql"');
  schema = schema.replace(/url\s*=\s*env\("[^"]+"\)/, `url      = env("${found.name}")`);
  fs.writeFileSync(schemaPath, schema, "utf8");
  console.log(`[prepare-db] Configured PostgreSQL using env("${found.name}")`);
} else {
  schema = schema.replace(/provider\s*=\s*"(?:sqlite|postgresql)"/, 'provider = "sqlite"');
  schema = schema.replace(/url\s*=\s*env\("[^"]+"\)/, 'url      = env("DATABASE_URL")');
  fs.writeFileSync(schemaPath, schema, "utf8");
  console.log('[prepare-db] Configured SQLite using env("DATABASE_URL")');
}
