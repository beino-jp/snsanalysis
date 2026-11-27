import { NextRequest, NextResponse } from "next/server";
import { requireInternalAuth as requireAuth } from "@/server/auth";
import { jobDetail } from "@/server/jobs";
export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const job = await jobDetail((await context.params).id);
    return NextResponse.json(job ?? { error: "ジョブが見つかりません" }, {
      status: job ? 200 : 404,
    });
  } catch {
    return NextResponse.json(
      { error: "認証またはDB接続を確認してください" },
      { status: 401 },
    );
  }
}
