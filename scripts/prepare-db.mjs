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
  for (const [name, raw] of Object.entries(process.env)) {
    const val = cleanVal(raw);
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

const targetProvider = found.isPostgres ? "postgresql" : "sqlite";
const targetEnvVar = found.isPostgres ? found.name : "DATABASE_URL";

const datasourceRegex = /datasource\s+db\s*\{[\s\S]*?\}/;
if (!datasourceRegex.test(schema)) {
  throw new Error("[prepare-db] Could not find datasource db { ... } block in prisma/schema.prisma");
}

schema = schema.replace(
  datasourceRegex,
  `datasource db {\n  provider = "${targetProvider}"\n  url      = env("${targetEnvVar}")\n}`
);
fs.writeFileSync(schemaPath, schema, "utf8");
console.log(`[prepare-db] Switched Prisma datasource -> ${targetProvider} using env("${targetEnvVar}")`);
