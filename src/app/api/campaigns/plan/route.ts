import { NextRequest, NextResponse } from "next/server";
import { requireMutation } from "@/server/auth";
import { proposeCampaign } from "@/server/campaigns";
export async function POST(req: NextRequest) {
  try {
    await requireMutation();
    return NextResponse.json(await proposeCampaign(await req.json()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return NextResponse.json(
      {
        error:
          message === "UNAUTHORIZED"
            ? "認証が必要です"
            : message.includes("配慮")
              ? message
              : "目的と条件を確認してください",
      },
      { status: message === "UNAUTHORIZED" ? 401 : 400 },
    );
  }
}
