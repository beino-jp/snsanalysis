import { NextRequest, NextResponse } from "next/server";
import { requireInternalAuth as requireAuth, requireInternalMutation as requireMutation } from "@/server/auth";
import { registerCampaign, listCampaigns } from "@/server/campaigns";
export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json(await listCampaigns());
  } catch {
    return NextResponse.json(
      {
        error:
          "検索一覧を読み込めません。DBの更新とログイン状態を確認してください",
      },
      { status: 400 },
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    await requireMutation();
    return NextResponse.json({ id: await registerCampaign(await req.json()) });
  } catch {
    return NextResponse.json(
      { error: "条件・配点・分析の選択を確認してください" },
      { status: 400 },
    );
  }
}
