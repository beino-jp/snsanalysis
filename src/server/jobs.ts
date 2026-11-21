import { analyzedUser } from "../domain/analyzed-users";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { query, transaction } from "./db";
import { defaults, Target } from "../domain/types";
import { MockDataProvider } from "../providers/mock";
import { ApifyDataProvider } from "../providers/apify";
import { isMock } from "./config";
import { PROMPT_VERSION } from "../prompts/attributes";
export const registration = z.object({
  url: z.string().url().max(500),
  project: z.string().min(1).max(100),
  influencer: z.string().max(100).optional(),
  reference: z.enum(["execution", "post"]).default("execution"),
});
export function validateUrl(raw: string) {
  const u = new URL(raw);
  if (
    u.username ||
    u.password ||
    u.protocol !== "https:" ||
    !["instagram.com", "www.instagram.com"].includes(u.hostname) ||
    !/^\/(p|reel)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)
  )
    throw Error("Instagramの公開投稿またはリールURLを入力してください");
  return `https://www.instagram.com${u.pathname.replace(/\/?$/, "/")}`;
}
export async function estimate(input: z.infer<typeof registration>) {
  const url = validateUrl(input.url);
  if (!isMock())
    throw Error(
      "実データ実行はP0の比較・入力仕様確認後に有効化してください。現在はモックデモです。",
    );
  const target = await new MockDataProvider(new Date().toISOString()).target(
    url,
  );
  return {
    target,
    provider: "mock",
    users: 48,
    cost: 0,
    time: "約15〜30秒",
    expectedLikes: 42,
    expectedComments: 29,
    limitation:
      "架空データ48人。取得率の差を確認するため表示件数より少ないデータを使用します。",
  };
}
export async function createJob(input: z.infer<typeof registration>) {
  const e = await estimate(input);
  const id = randomUUID(),
    pid = randomUUID(),
    tid = randomUUID();
  const settings = { ...defaults, reference: input.reference };
  await transaction(async (q) => {
    await q("INSERT INTO projects VALUES($1,$2,$3)", [pid, input.project, ""]);
    await q("INSERT INTO target_posts VALUES($1,$2,$3)", [
      tid,
      pid,
      JSON.stringify({
        ...e.target,
        owner: input.influencer || e.target.owner,
      }),
    ]);
    await q(
      "INSERT INTO jobs(id,target_post_id,reference_at,settings,provider,model,prompt_version,estimate) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        id,
        tid,
        input.reference === "post"
          ? e.target.postedAt
          : new Date().toISOString(),
        JSON.stringify(settings),
        "mock",
        "deterministic-fixture-v1",
        PROMPT_VERSION,
        JSON.stringify(e),
      ],
    );
    for (const kind of ["like", "comment"])
      await q("INSERT INTO job_tasks(job_id,kind) VALUES($1,$2)", [id, kind]);
  });
  return id;
}
export async function listJobs() {
  return query(
    "SELECT j.*,p.name AS project,t.payload AS target,a.payload AS aggregates FROM jobs j JOIN target_posts t ON t.id=j.target_post_id JOIN projects p ON p.id=t.project_id LEFT JOIN aggregates a ON a.job_id=j.id ORDER BY j.created_at DESC LIMIT 100",
  );
}
export async function jobDetail(id: string) {
  const job = (
    await query(
      "SELECT j.*,p.name AS project,t.payload AS target,a.payload AS aggregates FROM jobs j JOIN target_posts t ON t.id=j.target_post_id JOIN projects p ON p.id=t.project_id LEFT JOIN aggregates a ON a.job_id=j.id WHERE j.id=$1",
      [id],
    )
  )[0];
  if (!job) return null;
  const rows = await query(
    "SELECT u.payload AS profile,a.payload AS analysis, ARRAY(SELECT DISTINCT e.type FROM engagements e WHERE e.job_id=ja.job_id AND e.user_id=ja.user_id ORDER BY e.type) AS reactions FROM job_user_analyses ja JOIN user_analyses a ON a.id=ja.analysis_id JOIN sns_users u ON u.job_id=ja.job_id AND u.user_id=ja.user_id WHERE ja.job_id=$1",
    [id],
  );
  job.analyzedUsers = rows
    .filter((r) => !r.profile.private)
    .map((r, i) =>
      analyzedUser(
        r.profile,
        r.analysis,
        r.reactions,
        job.provider === "mock",
        String(i),
        job.settings.categories,
      ),
    );
  job.highInterest = rows
    .filter((r) => r.analysis.skate.result === "went")
    .map((r) => ({
      name: r.analysis.age === "10代" ? "非表示（10代）" : r.profile.username,
      age: r.analysis.age,
      reason:
        r.analysis.age === "10代"
          ? "アイススケート体験の根拠あり（個人情報は非表示）"
          : r.analysis.skate.reason,
      confidence: r.analysis.skate.confidence,
      links:
        r.analysis.age === "10代"
          ? []
          : r.analysis.skate.evidence.map((pid: string) => ({
              label: "根拠投稿",
              url:
                job.provider === "mock"
                  ? null
                  : `https://www.instagram.com/p/${pid}/`,
            })),
    }));
  return job;
}
