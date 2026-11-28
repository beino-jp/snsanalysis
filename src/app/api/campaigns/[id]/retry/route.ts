import { dispatchCloudflare } from "@/server/cloudflare-dispatch";
import { NextRequest, NextResponse } from "next/server";
import { requireInternalMutation as requireMutation } from "@/server/auth";
import { query } from "@/server/db";
export async function POST(
  _: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireMutation();
    const rows = await query(
      "UPDATE discovery_jobs SET status='queued',retries=0,error=NULL,lease_until=NULL,next_attempt=now() WHERE id=$1 AND status='error' RETURNING id",
      [(await ctx.params).id],
    );
    if (rows.length) await dispatchCloudflare((await ctx.params).id, "discovery", true);
    return NextResponse.json({ ok: rows.length > 0 });
  } catch {
    return NextResponse.json(
      { error: "再開できませんでした" },
      { status: 400 },
    );
  }
}
