import "dotenv/config";
export const isMock = () =>
  (process.env.DATA_PROVIDER ?? "mock") === "mock" &&
  (process.env.LLM_PROVIDER ?? "mock") === "mock";
export function assertConfiguration() {
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
