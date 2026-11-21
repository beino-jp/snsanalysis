import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireMutation } from "@/server/auth";
import { createJob, listJobs, registration } from "@/server/jobs";
export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json(await listJobs());
  } catch {
    return NextResponse.json(
      { error: "認証またはDB接続を確認してください" },
      { status: 401 },
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    await requireMutation();
    return NextResponse.json({
      id: await createJob(registration.parse(await req.json())),
    });
  } catch {
    return NextResponse.json(
      { error: "ジョブを登録できません。入力・DB接続を確認してください" },
      { status: 400 },
    );
  }
}
