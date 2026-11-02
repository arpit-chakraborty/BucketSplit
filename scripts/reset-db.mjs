import postgres from "postgres";
import fs from "fs";
import path from "path";

// Read env file directly without external dependencies
function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const connectionString = process.env.POSTGRES_URL_POOLED || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Error: Missing POSTGRES_URL in .env.local or .env");
  process.exit(1);
}

const client = postgres(connectionString, { ssl: "require" });

const DDL = [
  `CREATE TABLE IF NOT EXISTS "user" (
    "id" text PRIMARY KEY,
    "username" text NOT NULL UNIQUE,
    "password_hash" text NOT NULL,
    "name" text
  )`,
  `CREATE TABLE IF NOT EXISTS "bucket" (
    "id" text PRIMARY KEY,
    "name" text NOT NULL,
    "description" text,
    "invite_code" text NOT NULL UNIQUE,
    "created_by" text NOT NULL REFERENCES "user"("id"),
    "created_at" timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "bucket_member" (
    "bucket_id" text NOT NULL REFERENCES "bucket"("id") ON DELETE CASCADE,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "joined_at" timestamp NOT NULL DEFAULT now(),
    "last_subset_ids" text NOT NULL DEFAULT '[]',
    PRIMARY KEY ("bucket_id", "user_id")
  )`,
  `CREATE INDEX IF NOT EXISTS "bm_bucket_idx" ON "bucket_member"("bucket_id")`,
  `CREATE TABLE IF NOT EXISTS "expense" (
    "id" text PRIMARY KEY,
    "bucket_id" text NOT NULL REFERENCES "bucket"("id") ON DELETE CASCADE,
    "payer_id" text NOT NULL REFERENCES "user"("id"),
    "description" text NOT NULL,
    "total_amount_cents" integer NOT NULL,
    "mode" text NOT NULL,
    "created_at" timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "exp_bucket_idx" ON "expense"("bucket_id")`,
  `CREATE TABLE IF NOT EXISTS "expense_split" (
    "id" text PRIMARY KEY,
    "expense_id" text NOT NULL REFERENCES "expense"("id") ON DELETE CASCADE,
    "debtor_id" text NOT NULL REFERENCES "user"("id"),
    "owed_cents" integer NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "es_expense_idx" ON "expense_split"("expense_id")`,
  `CREATE TABLE IF NOT EXISTS "settlement" (
    "id" text PRIMARY KEY,
    "bucket_id" text NOT NULL REFERENCES "bucket"("id") ON DELETE CASCADE,
    "payer_id" text NOT NULL REFERENCES "user"("id"),
    "receiver_id" text NOT NULL REFERENCES "user"("id"),
    "amount_cents" integer NOT NULL,
    "status" text NOT NULL DEFAULT 'PENDING',
    "created_at" timestamp NOT NULL DEFAULT now(),
    "resolved_at" timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS "sett_bucket_idx" ON "settlement"("bucket_id")`,
  `CREATE TABLE IF NOT EXISTS "notification" (
    "id" text PRIMARY KEY,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "bucket_id" text REFERENCES "bucket"("id") ON DELETE CASCADE,
    "settlement_id" text REFERENCES "settlement"("id") ON DELETE CASCADE,
    "type" text NOT NULL,
    "message" text NOT NULL,
    "read" boolean NOT NULL DEFAULT false,
    "created_at" timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "notif_user_idx" ON "notification"("user_id")`
];

async function main() {
  console.log("1. Dropping existing tables and removing all testing data...");
  await client.unsafe(`
    DROP TABLE IF EXISTS "notification" CASCADE;
    DROP TABLE IF EXISTS "settlement" CASCADE;
    DROP TABLE IF EXISTS "expense_split" CASCADE;
    DROP TABLE IF EXISTS "expense" CASCADE;
    DROP TABLE IF EXISTS "bucket_member" CASCADE;
    DROP TABLE IF EXISTS "bucket" CASCADE;
    DROP TABLE IF EXISTS "user" CASCADE;
  `);

  console.log("2. Creating clean tables and indexes...");
  for (const stmt of DDL) {
    await client.unsafe(stmt);
  }

  console.log("Done! Database successfully wiped and re-initiated with a clean slate.");
  await client.end();
}

main().catch((err) => {
  console.error("Database reset error:", err);
  process.exit(1);
});
