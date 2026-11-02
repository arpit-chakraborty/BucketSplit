import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.POSTGRES_URL_POOLED ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  "";

export const client = postgres(connectionString, {
  ssl: "require",
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});
export const db = drizzle(client, { schema });

const DDL_STATEMENTS = [
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

let initPromise: Promise<void> | null = null;
export async function ensureDbTables() {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        for (const stmt of DDL_STATEMENTS) {
          await client.unsafe(stmt);
        }
      } catch (err) {
        console.error("Auto-create tables error:", err);
        initPromise = null;
        throw err;
      }
    })();
  }
  return initPromise;
}
