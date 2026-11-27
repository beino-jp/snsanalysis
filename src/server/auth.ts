import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { assertConfiguration, isMock } from "./config";
const secret = () =>
  process.env.SESSION_SECRET ?? "local-demo-session-only-do-not-use-in-live";
export function signSession(email: string) {
  const value = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + 8 * 3600000 }),
  ).toString("base64url");
  return (
    value + "." + createHmac("sha256", secret()).update(value).digest("hex")
  );
}
export async function requireAuth() {
  assertConfiguration();
  const value = (await cookies()).get("reach-session")?.value;
  const [body, sig] = value?.split(".") ?? [];
  if (!body || !sig) throw Error("UNAUTHORIZED");
  const expected = createHmac("sha256", secret()).update(body).digest("hex");
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  )
    throw Error("UNAUTHORIZED");
  const data = JSON.parse(Buffer.from(body, "base64url").toString());
  if (typeof data.email !== "string" || !Number.isFinite(data.exp) || data.exp < Date.now()) throw Error("UNAUTHORIZED");
  if (!(isMock() && process.env.DEMO_AUTH === "true") && !(process.env.ALLOWED_EMAILS ?? "").split(",").map(s=>s.trim().toLowerCase()).includes(data.email.toLowerCase())) throw Error("UNAUTHORIZED");
  return data.email as string;
}
export async function requireMutation() {
  await requireAuth();
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (
    !origin ||
    !(process.env.APP_ORIGIN ? origin === new URL(process.env.APP_ORIGIN).origin : new URL(origin).host === host)
  )
    throw Error("FORBIDDEN");
}
export async function authenticate(email: string, password: string) {
  assertConfiguration();
  if (isMock() && process.env.DEMO_AUTH === "true") {
    if (password !== (process.env.DEMO_PASSWORD ?? "local-demo"))
      throw Error("LOGIN_FAILED");
    return "demo@reach.local";
  }
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) throw Error("LOGIN_FAILED");
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase());
  if (!allowed.includes(data.user.email?.toLowerCase() ?? ""))
    throw Error("FORBIDDEN");
  return data.user.email!;
}
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.APP_ORIGIN?.startsWith("https:") ?? false,
    sameSite: "strict" as const,
    path: "/",
    maxAge: 8 * 3600,
  };
}
