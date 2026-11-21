import { randomUUID } from "node:crypto";
import { query } from "./db";
import {
  Goal,
  GoalSchema,
  PlanSchema,
  SEARCH_BUDGET_JPY,
} from "../domain/campaign/types";
import { RuleCampaignLLMProvider } from "../providers/campaign/mock";
import { scoreReach } from "../domain/campaign/scoring";
import type { Analysis } from "../domain/types";
export async function proposeCampaign(raw: unknown) {
  const goal = GoalSchema.parse(raw);
  const proposal = await new RuleCampaignLLMProvider().plan(goal);
  return {
    ...proposal,
    budgetYen: SEARCH_BUDGET_JPY,
    estimatedYen: 0,
    mode: "mock",
    scope: { accounts: 100, postsEach: 20, recommendations: 10 },
  };
}
export async function registerCampaign(raw: unknown) {
  const plan = PlanSchema.parse(raw);
  const normalized = await new RuleCampaignLLMProvider().plan(plan.goal);
  if (normalized.questions.length || !normalized.plan)
    throw Error("未回答の条件があります");
  if (
    plan.criteria.length !== normalized.plan.criteria.length ||
    plan.criteria.some(
      (c) => !normalized.plan!.criteria.some((v) => v.id === c.id),
    )
  )
    throw Error("評価項目が目的と一致していません");
  plan.goal = normalized.plan.goal;
  plan.queries = normalized.plan.queries;
  plan.summary = normalized.plan.summary;
  plan.criteria = normalized.plan.criteria.map((c) => ({
    ...c,
    weight: plan.criteria.find((v) => v.id === c.id)!.weight,
    target: plan.criteria.find((v) => v.id === c.id)!.target,
  }));
  // Free text and client edits never select a paid provider or raise the budget.
  const id = randomUUID();
  if (plan.goal.sourceJobId) {
    const job = (
      await query("SELECT status FROM jobs WHERE id=$1", [
        plan.goal.sourceJobId,
      ])
    )[0];
    if (job?.status !== "completed")
      throw Error("完了済みの分析を選んでください");
  }
  await query(
    "INSERT INTO discovery_jobs(id,plan,provider,budget_yen) VALUES($1,$2,'mock',$3)",
    [id, JSON.stringify(plan), SEARCH_BUDGET_JPY],
  );
  return id;
}
export async function listCampaigns() {
  return query(
    "SELECT id,status,plan,provider,budget_yen,spent_yen,reserved_yen,progress,created_at,error FROM discovery_jobs ORDER BY created_at DESC LIMIT 50",
  );
}
export async function campaignDetail(id: string) {
  const job = (
    await query("SELECT * FROM discovery_jobs WHERE id=$1", [id])
  )[0];
  if (!job) return null;
  // Only the selected adult/public recommendations leave the persistence layer.
  job.recommendations = job.report?.recommendations ?? [];
  delete job.targets;
  return job;
}
export async function reachReport(
  goal: Goal,
  plan: ReturnType<typeof PlanSchema.parse>,
) {
  if (!goal.sourceJobId) return null;
  const rows = await query(
    "SELECT a.payload FROM job_user_analyses ja JOIN user_analyses a ON a.id=ja.analysis_id JOIN sns_users u ON u.job_id=ja.job_id AND u.user_id=ja.user_id WHERE ja.job_id=$1 AND (u.payload->>'private')::boolean=false",
    [goal.sourceJobId],
  );
  const counts = (
    await query("SELECT payload FROM aggregates WHERE job_id=$1", [
      goal.sourceJobId,
    ])
  )[0]?.payload;
  return {
    ...scoreReach(
      rows.map((r) => r.payload as Analysis),
      plan,
    ),
    referenceOnly:
      !counts?.like.acquisition ||
      counts.like.acquisition < 0.2 ||
      !counts?.comment.acquisition ||
      counts.comment.acquisition < 0.2,
    acquisition: {
      like: counts?.like.acquisition ?? null,
      comment: counts?.comment.acquisition ?? null,
    },
    sourceJobId: goal.sourceJobId,
  };
}
