import { NextRequest, NextResponse } from "next/server";
import { requireMutation } from "@/server/auth";
import { query } from "@/server/db";
export async function POST(
  _: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireMutation();
    await query(
      "UPDATE discovery_jobs SET status='queued',retries=0,error=NULL,lease_until=NULL,next_attempt=now() WHERE id=$1 AND status='error'",
      [(await ctx.params).id],
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "再開できませんでした" },
      { status: 400 },
    );
  }
}
