import { dispatchCloudflare } from "@/server/cloudflare-dispatch";
import { NextRequest, NextResponse } from "next/server";
import { requireMutation } from "@/server/auth";
import { query } from "@/server/db";
export async function POST(
  _: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireMutation();
    const rows = await query(
      "UPDATE jobs SET status='queued', retries=0,error=NULL,lease_until=NULL,next_attempt=now() WHERE id=$1 AND status='error' RETURNING id",
      [(await context.params).id],
    );
    if (rows.length) await dispatchCloudflare((await context.params).id, "job", true);
    return NextResponse.json({ ok: rows.length > 0 });
  } catch {
    return NextResponse.json(
      { error: "再開できませんでした" },
      { status: 400 },
    );
  }
}
