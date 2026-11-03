// src/db/schema.ts
import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull()
});

export const buckets = pgTable("bucket", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const bucketMembers = pgTable(
  "bucket_member",
  {
    bucketId: text("bucket_id").notNull().references(() => buckets.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { mode: "date" }).notNull().defaultNow(),
    lastSubsetIds: text("last_subset_ids").notNull().default("[]"),
  },
  (t) => [
    primaryKey({ columns: [t.bucketId, t.userId] }),
    index("bm_bucket_idx").on(t.bucketId),
  ]
);

export const expenses = pgTable(
  "expense",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    bucketId: text("bucket_id").notNull().references(() => buckets.id, { onDelete: "cascade" }),
    payerId: text("payer_id").notNull().references(() => users.id),
    description: text("description").notNull(),
    totalAmountCents: integer("total_amount_cents").notNull(),
    mode: text("mode").$type<"split" | "direct">().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("exp_bucket_idx").on(t.bucketId)]
);

export const expenseSplits = pgTable(
  "expense_split",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    expenseId: text("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
    debtorId: text("debtor_id").notNull().references(() => users.id),
    owedCents: integer("owed_cents").notNull(),
  },
  (t) => [index("es_expense_idx").on(t.expenseId)]
);

export const settlements = pgTable(
  "settlement",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    bucketId: text("bucket_id").notNull().references(() => buckets.id, { onDelete: "cascade" }),
    payerId: text("payer_id").notNull().references(() => users.id),
    receiverId: text("receiver_id").notNull().references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").$type<"PENDING" | "CONFIRMED" | "REJECTED">().notNull().default("PENDING"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
  },
  (t) => [index("sett_bucket_idx").on(t.bucketId)]
);

export const notifications = pgTable(
  "notification",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    bucketId: text("bucket_id").references(() => buckets.id, { onDelete: "cascade" }),
    settlementId: text("settlement_id").references(() => settlements.id, { onDelete: "cascade" }),
    type: text("type").$type<"SETTLEMENT_PENDING" | "SETTLEMENT_CONFIRMED" | "SETTLEMENT_REJECTED">().notNull(),
    message: text("message").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("notif_user_idx").on(t.userId)]
);

export type User = typeof users.$inferSelect;
export type Bucket = typeof buckets.$inferSelect;
export type BucketMember = typeof bucketMembers.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
