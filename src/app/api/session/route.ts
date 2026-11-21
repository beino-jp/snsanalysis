import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { isMock } from "@/server/config";
export async function GET() {
  try {
    return NextResponse.json({ email: await requireAuth(), mock: isMock() });
  } catch {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
}
