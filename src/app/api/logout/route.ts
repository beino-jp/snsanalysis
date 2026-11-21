import { NextResponse } from "next/server";
import { requireMutation } from "@/server/auth";
export async function POST() {
  try {
    await requireMutation();
    const r = NextResponse.json({ ok: true });
    r.cookies.set("reach-session", "", { maxAge: 0, path: "/" });
    return r;
  } catch {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
}
