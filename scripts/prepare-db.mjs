import fs from "node:fs";
import path from "node:path";

// Bulletproof DB provider switcher for local SQLite vs Vercel PostgreSQL
const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");

const preferredDirectOrder = [
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL",
  "DATABASE_URL",
  "STORAGE_POSTGRES_URL",
  "STORAGE_DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "PRISMA_DATABASE_URL",
];

function cleanVal(v) {
  return (v || "").trim().replace(/^["']|["']$/g, "");
}

function findDbEnvVar() {
  const dbRelated = Object.entries(process.env)
    .filter(([k]) => /DATABASE|POSTGRES|PRISMA|STORAGE/i.test(k) && /URL$/i.test(k))
    .map(([k, v]) => {
      const c = cleanVal(v);
      const proto = c.includes("://") ? c.split("://")[0] + "://" : "(other)";
      return `${k}=${proto}`;
    });
  console.log("[prepare-db] Detected DB env vars:", dbRelated.join(", ") || "none");

  // 1. Prefer direct postgres:// or postgresql:// URLs (required by prisma db push)
  for (const name of preferredDirectOrder) {
    const val = cleanVal(process.env[name]);
    if (val.startsWith("postgres://") || val.startsWith("postgresql://")) {
      return { name, isPostgres: true };
    }
  }
  for (const [name, raw] of Object.entries(process.env)) {
    const val = cleanVal(raw);
    if (val.startsWith("postgres://") || val.startsWith("postgresql://")) {
      return { name, isPostgres: true };
    }
  }

  // 2. Fallback to prisma+postgres:// (or any Vercel environment)
  for (const name of preferredDirectOrder) {
    const val = cleanVal(process.env[name]);
    if (val.startsWith("prisma+postgres://")) {
      return { name, isPostgres: true };
    }
  }

  if (process.env.VERCEL === "1" || process.env.VERCEL === "true") {
    return { name: "DATABASE_URL", isPostgres: true };
  }

  return { name: "DATABASE_URL", isPostgres: false };
}

const found = findDbEnvVar();
let schema = fs.readFileSync(schemaPath, "utf8");

if (found.isPostgres) {
  schema = schema.replace(/provider\s*=\s*"(?:sqlite|postgresql)"/, 'provider = "postgresql"');
  schema = schema.replace(/url\s*=\s*env\("[^"]+"\)/, `url      = env("${found.name}")`);
  fs.writeFileSync(schemaPath, schema, "utf8");
  console.log(`[prepare-db] Switched Prisma datasource -> postgresql using env("${found.name}")`);
} else {
  schema = schema.replace(/provider\s*=\s*"(?:sqlite|postgresql)"/, 'provider = "sqlite"');
  schema = schema.replace(/url\s*=\s*env\("[^"]+"\)/, 'url      = env("DATABASE_URL")');
  fs.writeFileSync(schemaPath, schema, "utf8");
  console.log('[prepare-db] Switched Prisma datasource -> sqlite using env("DATABASE_URL")');
}
