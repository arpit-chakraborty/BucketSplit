"use server";

import { revalidatePath } from "next/cache";
import { auth, signIn, signOut } from "@/auth";
import { db, ensureDbTables } from "@/db";
import {
  buckets,
  bucketMembers,
  expenses,
  expenseSplits,
  settlements,
  notifications,
  users,
} from "@/db/schema";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { customAlphabet } from "nanoid";
import { hashPassword } from "@/lib/auth-utils";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import type {
  BucketSummary,
  PairwiseBalance,
  BucketListItem,
  AppNotification,
  PendingSettlement,
  RecentExpense,
  BucketMemberInfo,
} from "@/lib/types";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

async function getSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  return session;
}

async function assertMember(userId: string, bucketId: string) {
  const row = await db.query.bucketMembers.findFirst({
    where: and(
      eq(bucketMembers.userId, userId),
      eq(bucketMembers.bucketId, bucketId)
    ),
  });
  if (!row) throw new Error("Not a bucket member");
  return row;
}

// ─── Auth Actions ─────────────────────────────────────────────────────────────

export async function registerUser(formData: FormData) {
  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!username || username.length < 3) {
    throw new Error("Username must be at least 3 characters");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  await ensureDbTables();

  const existing = await db.query.users.findFirst({
    where: eq(users.username, username),
  });
  if (existing) {
    throw new Error("Username already taken");
  }

  const passwordHash = await hashPassword(password);
  await db.insert(users).values({
    username,
    name: username,
    passwordHash,
  });

  try {
    await signIn("credentials", {
      username,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    const isRedirect = isRedirectError(error) || (error as any)?.digest?.startsWith("NEXT_REDIRECT");
    if (isRedirect) throw error;
    const msg = (error as any)?.cause?.message || (error as any)?.message;
    throw new Error(msg || "Failed to sign in after registration");
  }
}

export async function loginUser(formData: FormData) {
  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!username || !password) {
    throw new Error("Username and password are required");
  }

  await ensureDbTables();

  try {
    await signIn("credentials", {
      username,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    const isRedirect = isRedirectError(error) || (error as any)?.digest?.startsWith("NEXT_REDIRECT");
    if (isRedirect) throw error;
    if ((error as any)?.type === "CredentialsSignin") {
      throw new Error("Invalid username or password");
    }
    const msg = (error as any)?.cause?.message || (error as any)?.message;
    throw new Error(msg && !msg.includes("CredentialsSignin") ? msg : "Invalid username or password");
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/auth/signin" });
}

// ─── Bucket Actions ───────────────────────────────────────────────────────────

export async function createBucket(formData: FormData) {
  const session = await getSession();
  const name = (formData.get("name") as string).trim();
  const description = ((formData.get("description") as string) ?? "").trim();
  if (!name) throw new Error("Name required");

  const [bucket] = await db
    .insert(buckets)
    .values({ name, description, inviteCode: nanoid(), createdBy: session.user.id })
    .returning();

  await db.insert(bucketMembers).values({ bucketId: bucket.id, userId: session.user.id });

  revalidatePath("/dashboard");
  return { bucketId: bucket.id };
}

export async function joinBucket(formData: FormData) {
  const session = await getSession();
  const code = (formData.get("code") as string).trim().toUpperCase();

  const bucket = await db.query.buckets.findFirst({
    where: eq(buckets.inviteCode, code),
  });
  if (!bucket) throw new Error("Invalid invite code");

  const existing = await db.query.bucketMembers.findFirst({
    where: and(eq(bucketMembers.bucketId, bucket.id), eq(bucketMembers.userId, session.user.id)),
  });
  if (existing) return { bucketId: bucket.id };

  await db.insert(bucketMembers).values({ bucketId: bucket.id, userId: session.user.id });

  revalidatePath("/dashboard");
  return { bucketId: bucket.id };
}

export async function getUserBuckets(): Promise<BucketListItem[]> {
  const session = await getSession();
  const uid = session.user.id;

  const rows = await db
    .select({
      id: buckets.id,
      name: buckets.name,
      description: buckets.description,
      inviteCode: buckets.inviteCode,
      createdAt: buckets.createdAt,
      memberCount: sql<number>`(SELECT COUNT(*)::int FROM bucket_member WHERE bucket_id = ${buckets.id})`,
    })
    .from(bucketMembers)
    .innerJoin(buckets, eq(buckets.id, bucketMembers.bucketId))
    .where(eq(bucketMembers.userId, uid))
    .orderBy(sql`${buckets.createdAt} DESC`);

  return rows.map((r) => ({
    bucket: {
      id: r.id,
      name: r.name,
      description: r.description,
      inviteCode: r.inviteCode,
      createdAt: r.createdAt,
    },
    memberCount: r.memberCount,
  }));
}

export async function addExpense(formData: FormData) {
  const session = await getSession();
  const bucketId = formData.get("bucketId") as string;
  const uid = session.user.id;

  await assertMember(uid, bucketId);

  const description = (formData.get("description") as string).trim();
  const amountStr = formData.get("amount") as string;
  const mode = formData.get("mode") as "split" | "direct";
  const totalAmountCents = Math.round(parseFloat(amountStr) * 100);
  if (!description || isNaN(totalAmountCents) || totalAmountCents <= 0)
    throw new Error("Invalid expense data");

  if (mode === "split") {
    const participantIds = (formData.getAll("participants") as string[]).filter(Boolean);
    if (participantIds.length === 0) throw new Error("Select at least one participant");

    await db
      .update(bucketMembers)
      .set({ lastSubsetIds: JSON.stringify(participantIds) })
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, uid)));

    const [expense] = await db
      .insert(expenses)
      .values({ bucketId, payerId: uid, description, totalAmountCents, mode })
      .returning();

    const n = participantIds.length;
    const baseShare = Math.floor(totalAmountCents / n);
    const remainder = totalAmountCents - baseShare * n;

    const splits = participantIds.map((debtorId, i) => {
      const share = i < remainder ? baseShare + 1 : baseShare;
      const owedCents = debtorId === uid ? 0 : share;
      return { expenseId: expense.id, debtorId, owedCents };
    });

    await db.insert(expenseSplits).values(splits);
  } else {
    const debtorId = formData.get("debtorId") as string;
    if (!debtorId || debtorId === uid) throw new Error("Invalid debtor for direct mode");
    await assertMember(debtorId, bucketId);

    const [expense] = await db
      .insert(expenses)
      .values({ bucketId, payerId: uid, description, totalAmountCents, mode })
      .returning();

    await db
      .insert(expenseSplits)
      .values({ expenseId: expense.id, debtorId, owedCents: totalAmountCents });
  }

  revalidatePath(`/bucket/${bucketId}`);
}

export async function getBucketSummary(bucketId: string): Promise<BucketSummary> {
  const session = await getSession();
  const uid = session.user.id;

  // 1. Validate membership and bucket existence in parallel
  const [memberRow, bucket] = await Promise.all([
    db.query.bucketMembers.findFirst({
      where: and(eq(bucketMembers.userId, uid), eq(bucketMembers.bucketId, bucketId)),
    }),
    db.query.buckets.findFirst({ where: eq(buckets.id, bucketId) }),
  ]);

  if (!memberRow) throw new Error("Not a bucket member");
  if (!bucket) throw new Error("Bucket not found");

  const payerUser = alias(users, "payer_user");
  const receiverUser = alias(users, "receiver_user");

  // 2. Fetch all bucket data in parallel (single round-trip batch)
  const [memberRows, splitRows, confirmedSettlements, pendingRows, recentRows] = await Promise.all([
    // Members with names
    db
      .select({
        userId: bucketMembers.userId,
        lastSubsetIds: bucketMembers.lastSubsetIds,
        name: users.name,
      })
      .from(bucketMembers)
      .innerJoin(users, eq(users.id, bucketMembers.userId))
      .where(eq(bucketMembers.bucketId, bucketId)),

    // Expense splits
    db
      .select({
        debtorId: expenseSplits.debtorId,
        payerId: expenses.payerId,
        owedCents: expenseSplits.owedCents,
      })
      .from(expenseSplits)
      .innerJoin(expenses, eq(expenses.id, expenseSplits.expenseId))
      .where(eq(expenses.bucketId, bucketId)),

    // Confirmed settlements
    db
      .select({
        payerId: settlements.payerId,
        receiverId: settlements.receiverId,
        amountCents: settlements.amountCents,
      })
      .from(settlements)
      .where(and(eq(settlements.bucketId, bucketId), eq(settlements.status, "CONFIRMED"))),

    // Pending settlements with names in one query
    db
      .select({
        id: settlements.id,
        bucketId: settlements.bucketId,
        payerId: settlements.payerId,
        receiverId: settlements.receiverId,
        amountCents: settlements.amountCents,
        status: settlements.status,
        createdAt: settlements.createdAt,
        resolvedAt: settlements.resolvedAt,
        payerName: payerUser.name,
        receiverName: receiverUser.name,
      })
      .from(settlements)
      .leftJoin(payerUser, eq(payerUser.id, settlements.payerId))
      .leftJoin(receiverUser, eq(receiverUser.id, settlements.receiverId))
      .where(
        and(
          eq(settlements.bucketId, bucketId),
          eq(settlements.status, "PENDING"),
          or(eq(settlements.payerId, uid), eq(settlements.receiverId, uid))
        )
      ),

    // Recent 20 expenses with payer names in one query
    db
      .select({
        id: expenses.id,
        description: expenses.description,
        totalAmountCents: expenses.totalAmountCents,
        mode: expenses.mode,
        createdAt: expenses.createdAt,
        payerName: users.name,
      })
      .from(expenses)
      .leftJoin(users, eq(users.id, expenses.payerId))
      .where(eq(expenses.bucketId, bucketId))
      .orderBy(sql`${expenses.createdAt} DESC`)
      .limit(20),
  ]);

  const members: BucketMemberInfo[] = memberRows.map((m) => ({
    userId: m.userId,
    name: m.name,
    lastSubsetIds: JSON.parse(m.lastSubsetIds || "[]") as string[],
  }));

  const memberUserIds = members.map((m) => m.userId);
  const userMap = new Map(members.map((m) => [m.userId, m]));

  const gross: Record<string, Record<string, number>> = {};
  const ensure = (a: string, b: string) => {
    gross[a] ??= {};
    gross[a][b] ??= 0;
  };

  for (const row of splitRows) {
    if (row.debtorId === row.payerId || row.owedCents === 0) continue;
    ensure(row.debtorId, row.payerId);
    gross[row.debtorId][row.payerId] += row.owedCents;
  }

  for (const s of confirmedSettlements) {
    ensure(s.payerId, s.receiverId);
    gross[s.payerId][s.receiverId] = Math.max(0, gross[s.payerId][s.receiverId] - s.amountCents);
  }

  const balances: PairwiseBalance[] = [];
  for (const counterpartId of memberUserIds) {
    if (counterpartId === uid) continue;
    const iOwe = gross[uid]?.[counterpartId] ?? 0;
    const theyOwe = gross[counterpartId]?.[uid] ?? 0;
    const netCents = iOwe - theyOwe;
    if (netCents === 0) continue;
    const cp = userMap.get(counterpartId);
    balances.push({
      counterpartId,
      counterpartName: cp?.name ?? null,
      netCents,
    });
  }

  return {
    bucket,
    members,
    balances,
    pendingSettlements: pendingRows as PendingSettlement[],
    recentExpenses: recentRows as RecentExpense[],
  };
}

export async function initiateSettlement(formData: FormData) {
  const session = await getSession();
  const uid = session.user.id;
  const bucketId = formData.get("bucketId") as string;
  const receiverId = formData.get("receiverId") as string;
  const amountCents = parseInt(formData.get("amountCents") as string, 10);

  await assertMember(uid, bucketId);
  await assertMember(receiverId, bucketId);
  if (isNaN(amountCents) || amountCents <= 0) throw new Error("Invalid amount");

  const [settlement] = await db
    .insert(settlements)
    .values({ bucketId, payerId: uid, receiverId, amountCents, status: "PENDING" })
    .returning();

  const payer = await db.query.users.findFirst({ where: eq(users.id, uid) });
  const fmtAmt = (amountCents / 100).toFixed(2);

  await db.insert(notifications).values({
    userId: receiverId,
    bucketId,
    settlementId: settlement.id,
    type: "SETTLEMENT_PENDING",
    message: `${payer?.name ?? "Someone"} marked ₹${fmtAmt} as paid to you. Please confirm.`,
  });

  revalidatePath(`/bucket/${bucketId}`);
  return { settlementId: settlement.id };
}

export async function respondToSettlement(formData: FormData) {
  const session = await getSession();
  const uid = session.user.id;
  const settlementId = formData.get("settlementId") as string;
  const response = formData.get("response") as "CONFIRMED" | "REJECTED";

  const settlement = await db.query.settlements.findFirst({
    where: eq(settlements.id, settlementId),
  });
  if (!settlement) throw new Error("Settlement not found");
  if (settlement.receiverId !== uid) throw new Error("Unauthorized");
  if (settlement.status !== "PENDING") throw new Error("Already resolved");

  await assertMember(uid, settlement.bucketId);

  await db
    .update(settlements)
    .set({ status: response, resolvedAt: new Date() })
    .where(eq(settlements.id, settlementId));

  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.settlementId, settlementId),
        eq(notifications.userId, uid),
        eq(notifications.type, "SETTLEMENT_PENDING")
      )
    );

  const receiver = await db.query.users.findFirst({ where: eq(users.id, uid) });
  const fmtAmt = (settlement.amountCents / 100).toFixed(2);
  const type = response === "CONFIRMED" ? "SETTLEMENT_CONFIRMED" : "SETTLEMENT_REJECTED";
  const message =
    response === "CONFIRMED"
      ? `${receiver?.name ?? "Receiver"} confirmed your ₹${fmtAmt} payment.`
      : `${receiver?.name ?? "Receiver"} rejected your ₹${fmtAmt} payment. Follow up with them.`;

  await db.insert(notifications).values({
    userId: settlement.payerId,
    bucketId: settlement.bucketId,
    settlementId,
    type,
    message,
  });

  revalidatePath(`/bucket/${settlement.bucketId}`);
}

export async function getUnreadNotifications(): Promise<AppNotification[]> {
  const session = await getSession();
  const rows = await db.query.notifications.findMany({
    where: and(eq(notifications.userId, session.user.id), eq(notifications.read, false)),
    orderBy: sql`${notifications.createdAt} DESC`,
    limit: 20,
  });
  return rows as AppNotification[];
}

export async function markNotificationRead(notificationId: string) {
  const session = await getSession();
  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(eq(notifications.id, notificationId), eq(notifications.userId, session.user.id))
    );
  revalidatePath("/dashboard");
}
