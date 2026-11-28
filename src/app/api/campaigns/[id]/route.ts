import { NextRequest, NextResponse } from "next/server";
import { requireInternalAuth as requireAuth } from "@/server/auth";
import { campaignDetail } from "@/server/campaigns";
export async function GET(
  _: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const job = await campaignDetail((await ctx.params).id);
    return NextResponse.json(job ?? { error: "検索が見つかりません" }, {
      status: job ? 200 : 404,
    });
  } catch {
    return NextResponse.json(
      { error: "検索結果を読み込めません" },
      { status: 400 },
    );
  }
}
