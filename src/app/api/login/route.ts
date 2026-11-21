import { NextRequest, NextResponse } from "next/server";
import { authenticate, cookieOptions, signSession } from "@/server/auth";
import { z } from "zod";
const attempts = new Map<string, { n: number; at: number }>();
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== req.headers.get("host"))
      return NextResponse.json(
        { error: "アクセスが許可されていません" },
        { status: 403 },
      );
    const key = req.headers.get("x-forwarded-for") ?? "local";
    const previous = attempts.get(key);
    const record =
      previous && Date.now() - previous.at < 600000
        ? previous
        : { n: 0, at: Date.now() };
    if (record.n >= 10)
      return NextResponse.json(
        { error: "時間をおいて再試行してください" },
        { status: 429 },
      );
    record.n++;
    attempts.set(key, record);
    const input = z
      .object({ email: z.string().max(200), password: z.string().max(200) })
      .parse(await req.json());
    const email = await authenticate(input.email, input.password);
    const res = NextResponse.json({ ok: true });
    res.cookies.set("reach-session", signSession(email), cookieOptions());
    attempts.delete(key);
    return res;
  } catch {
    return NextResponse.json(
      {
        error:
          "ログインできませんでした。認証情報と社内アカウント設定を確認してください。",
      },
      { status: 401 },
    );
  }
}
