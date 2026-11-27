import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireInternalAuth as requireAuth, requireInternalMutation as requireMutation } from "@/server/auth";
import { query } from "@/server/db";
import { parseValidationReport } from "@/domain/validation-report";
export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json(
      await query(
        "SELECT id,payload,created_at FROM validation_reports ORDER BY created_at DESC LIMIT 100",
      ),
    );
  } catch {
    return NextResponse.json(
      {
        error: "記録を読み込めません。ログイン状態とDB更新を確認してください。",
      },
      { status: 400 },
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    await requireMutation();
    const text = await req.text();
    if (Buffer.byteLength(text) > 262144)
      return NextResponse.json(
        { error: "ファイルは256KB以下にしてください" },
        { status: 413 },
      );
    const input = JSON.parse(text);
    const report = parseValidationReport(input.journal, input.url);
    const id = createHash("sha256")
      .update(report.url + "|" + report.startedAt + "|" + (report.audience?.analyzedAt ?? ""))
      .digest("hex");
    await query(
      "INSERT INTO validation_reports(id,payload) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload",
      [id, JSON.stringify(report)],
    );
    return NextResponse.json({ id, report });
  } catch {
    return NextResponse.json(
      {
        error:
          "完了した検証JSONと投稿URLを指定してください。設定・DB更新も確認してください。",
      },
      { status: 400 },
    );
  }
}
