import { NextResponse } from "next/server";
import { client, ensureDbTables } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DB_RESET !== "true") {
    return NextResponse.json(
      { error: "Database reset is disabled in production for security." },
      { status: 403 }
    );
  }

  try {
    await client.unsafe(`
      DROP TABLE IF EXISTS "notification" CASCADE;
      DROP TABLE IF EXISTS "settlement" CASCADE;
      DROP TABLE IF EXISTS "expense_split" CASCADE;
      DROP TABLE IF EXISTS "expense" CASCADE;
      DROP TABLE IF EXISTS "bucket_member" CASCADE;
      DROP TABLE IF EXISTS "bucket" CASCADE;
      DROP TABLE IF EXISTS "user" CASCADE;
    `);

    await ensureDbTables();

    return NextResponse.json({
      success: true,
      message: "Database wiped and re-initiated cleanly! All test data has been removed.",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}
