import { NextRequest, NextResponse } from "next/server";
import { requireInternalMutation as requireMutation } from "@/server/auth";
import { estimate, registration } from "@/server/jobs";
export async function POST(req: NextRequest) {
  try {
    await requireMutation();
    return NextResponse.json(
      await estimate(registration.parse(await req.json())),
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return NextResponse.json(
      {
        error:
          m === "UNAUTHORIZED"
            ? "認証が必要です"
            : m.includes("Instagram") || m.includes("P0")
              ? m
              : "入力内容を確認してください",
      },
      { status: m === "UNAUTHORIZED" ? 401 : 400 },
    );
  }
}
