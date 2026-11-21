import { query } from "../server/db";
import { PlanSchema } from "../domain/campaign/types";
import { scoreCandidate, rankCandidates } from "../domain/campaign/scoring";
import { MockDiscoveryProvider } from "../providers/campaign/mock";
import { reserveCharge, settleCharge } from "../server/discovery-budget";
import { reachReport } from "../server/campaigns";
export async function tickDiscovery(job: Record<string, any>) {
  if (job.provider !== "mock")
    throw Error("実データProviderは料金と入力仕様の検証後に有効化してください");
  const plan = PlanSchema.parse(job.plan),
    reference = new Date(job.reference_at).toISOString(),
    data = new MockDiscoveryProvider(reference);
  if (!job.targets) {
    await reserveCharge(job.id, "search", 0);
    const targets = [...new Set(await data.search(plan.queries, 100))].slice(
      0,
      100,
    );
    await settleCharge(job.id, "search", 0);
    await query(
      "UPDATE discovery_jobs SET targets=$2,status='running',progress=5 WHERE id=$1",
      [job.id, JSON.stringify(targets)],
    );
    return;
  }
  const targets = job.targets as string[],
    done = await query(
      "SELECT username FROM discovery_candidates WHERE job_id=$1",
      [job.id],
    ),
    completed = new Set(done.map((r) => r.username));
  const username = targets.find((t) => !completed.has(t));
  if (username) {
    await reserveCharge(job.id, username, 0);
    const candidate = await data.candidate(username, 20),
      assessment = scoreCandidate(candidate, plan, reference);
    await settleCharge(job.id, username, 0);
    // Private and possible minor candidates are discarded rather than exposed as recommendations.
    const stored = assessment.excluded
      ? {
          ...candidate,
          username: "excluded",
          name: "対象外",
          bio: "",
          posts: [],
          profileUrl: "",
        }
      : candidate;
    await query(
      "INSERT INTO discovery_candidates VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [job.id, username, JSON.stringify(stored), JSON.stringify(assessment)],
    );
    await query("UPDATE discovery_jobs SET progress=$2 WHERE id=$1", [
      job.id,
      Math.min(
        95,
        5 + Math.floor(((done.length + 1) / Math.max(1, targets.length)) * 90),
      ),
    ]);
    return;
  }
  const all = await query(
    "SELECT candidate,assessment FROM discovery_candidates WHERE job_id=$1",
    [job.id],
  );
  const recommendations = rankCandidates(
      all.map((r) => ({ candidate: r.candidate, assessment: r.assessment })),
    ),
    reach = await reachReport(plan.goal, plan);
  await query(
    "UPDATE discovery_jobs SET report=$2,status='completed',progress=100,completed_at=now() WHERE id=$1",
    [
      job.id,
      JSON.stringify({
        recommendations,
        reach,
        searched: targets.length,
        analyzed: all.filter((r) => !r.assessment.excluded).length,
        excluded: all.filter((r) => r.assessment.excluded).length,
        notice:
          "検索できた公開情報の範囲での推薦です。Instagram全体を網羅するものではありません。反応ユーザーの属性や実際の来場・購入効果は評価していません。",
      }),
    ],
  );
}
export async function runDiscoveryTick() {
  const job = (
    await query(
      "UPDATE discovery_jobs SET lease_until=now()+interval '2 minutes' WHERE id=(SELECT id FROM discovery_jobs WHERE status IN ('queued','running') AND next_attempt<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *",
    )
  )[0];
  if (!job) return;
  try {
    await tickDiscovery(job);
    await query(
      "UPDATE discovery_jobs SET lease_until=NULL,retries=0,error=NULL WHERE id=$1",
      [job.id],
    );
  } catch (e) {
    const budget = e instanceof Error && e.message === "BUDGET_LIMIT";
    await query(
      "UPDATE discovery_jobs SET lease_until=NULL,retries=retries+1,status=CASE WHEN $2 THEN 'budget_stopped' WHEN retries>=4 THEN 'error' ELSE status END,error=$3,next_attempt=now()+(LEAST(60,power(2,retries+1))*interval '1 second') WHERE id=$1",
      [
        job.id,
        budget,
        budget
          ? "残予算が不足したため追加取得を停止しました"
          : "候補取得に失敗しました。設定を確認して再開してください。",
      ],
    );
  }
}
