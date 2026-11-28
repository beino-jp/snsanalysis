import "dotenv/config";
export const isMock = () =>
  (process.env.DATA_PROVIDER ?? "mock") === "mock" &&
  (process.env.LLM_PROVIDER ?? "mock") === "mock";
export function assertConfiguration() {
  if (process.env.NODE_ENV === "production") {
    const origin = new URL(process.env.APP_ORIGIN ?? "http://invalid.local");
    const key = process.env.SESSION_SECRET ?? "";
    if (process.env.DEMO_AUTH !== "false" || origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || (!process.env.DATABASE_URL && process.env.DEPLOY_TARGET !== "cloudflare") || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !(process.env.ALLOWED_EMAILS ?? "").split(",").some(s=>s.trim()) || key.length < 32 || key.includes("replace-with") || key.includes("local-demo"))
      throw Error("共有環境にはHTTPS・招待認証・許可メール・DB・専用署名鍵の設定が必要です");
  }
  if (!isMock() && process.env.DEMO_AUTH === "true")
    throw Error("実データモードではデモ認証を利用できません");
  if (
    !isMock() &&
    (!process.env.SUPABASE_URL ||
      !process.env.SUPABASE_ANON_KEY ||
      !process.env.SESSION_SECRET ||
      process.env.SESSION_SECRET.length < 32)
  )
    throw Error("実データモードには社内認証とSESSION_SECRETの設定が必要です");
}
export const safeError = () =>
  "処理に失敗しました。接続設定・Providerの入力仕様を確認し、再開してください。";
