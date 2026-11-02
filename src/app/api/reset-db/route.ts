import { NextResponse } from "next/server";
import { client, ensureDbTables } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Drop all tables and dependencies
    await client.unsafe(`
      DROP TABLE IF EXISTS "notification" CASCADE;
      DROP TABLE IF EXISTS "settlement" CASCADE;
      DROP TABLE IF EXISTS "expense_split" CASCADE;
      DROP TABLE IF EXISTS "expense" CASCADE;
      DROP TABLE IF EXISTS "bucket_member" CASCADE;
      DROP TABLE IF EXISTS "bucket" CASCADE;
      DROP TABLE IF EXISTS "user" CASCADE;
    `);

    // Recreate clean schema
    await ensureDbTables();

    return NextResponse.json({
      success: true,
      message: "Database wiped and re-initiated cleanly! All test data has been removed.",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}
