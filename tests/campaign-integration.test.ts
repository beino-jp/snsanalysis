import { it, expect, describe, afterAll } from "vitest";
import { db, query } from "../src/server/db";
import { GoalSchema } from "../src/domain/campaign/types";
import { planGoal } from "../src/domain/campaign/plan";
import {
  registerCampaign,
  campaignDetail,
  reachReport,
} from "../src/server/campaigns";
import { createJob } from "../src/server/jobs";
import { tickJob } from "../src/worker/process";
import { DEMO_URL } from "../src/fixtures/demo";
import { tickDiscovery } from "../src/worker/discovery";
import { reserveCharge, settleCharge } from "../src/server/discovery-budget";
const enabled = process.env.RUN_DB_TESTS === "true";
const plan = planGoal(
  GoalSchema.parse({
    purpose: "東京でカップルと子連れにスケートを紹介して集客したい",
    targetTags: ["カップル", "子持ち"],
    ages: ["20代", "30代"],
  }),
).plan!;
describe.skipIf(!enabled)("purpose-based discovery with PostgreSQL", () => {
  it("evaluates at most 100 accounts with 20 posts each, resumes and returns ten scored adults", async () => {
    const id = await registerCampaign(plan);
    try {
      for (let i = 0; i < 110; i++) {
        const j = (
          await query("SELECT * FROM discovery_jobs WHERE id=$1", [id])
        )[0];
        if (j.status === "completed") break;
        await tickDiscovery(j);
      }
      const result = await campaignDetail(id);
      if (!result) throw Error("検索結果がありません");
      expect(result.status).toBe("completed");
      expect(result.budget_yen).toBe(3000);
      expect(result.spent_yen).toBe(0);
      expect(result.reserved_yen).toBe(0);
      expect(result.targets).toBeUndefined();
      expect(result.report.searched).toBe(100);
      expect(result.recommendations).toHaveLength(10);
      expect(
        result.recommendations.every(
          (r: any) =>
            !r.candidate.minor &&
            !r.candidate.private &&
            r.candidate.posts.length <= 20,
        ),
      ).toBe(true);
      expect(result.report.reach).toBeNull();
      const count = (
        await query(
          "SELECT count(*) AS n FROM discovery_candidates WHERE job_id=$1",
          [id],
        )
      )[0].n;
      await tickDiscovery(
        (await query("SELECT * FROM discovery_jobs WHERE id=$1", [id]))[0],
      );
      expect(
        (
          await query(
            "SELECT count(*) AS n FROM discovery_candidates WHERE job_id=$1",
            [id],
          )
        )[0].n,
      ).toBe(count);
    } finally {
      await query("DELETE FROM discovery_jobs WHERE id=$1", [id]);
    }
  }, 30000);
  it("scores a saved PR analysis separately and flags low acquisition", async () => {
    const source = await createJob({
      url: DEMO_URL,
      project: "campaign-source-test",
      reference: "execution",
    });
    try {
      for (let i = 0; i < 100; i++) {
        const j = (await query("SELECT * FROM jobs WHERE id=$1", [source]))[0];
        if (j.status === "completed") break;
        await tickJob(j);
      }
      const linked = { ...plan, goal: { ...plan.goal, sourceJobId: source } };
      const report = await reachReport(linked.goal, linked);
      expect(report?.denominator).toBe(42);
      expect(report?.referenceOnly).toBe(true);
      expect(typeof report?.score).toBe("number");
      expect(report?.parts.length).toBe(3);
    } finally {
      const analyses = (
        await query(
          "SELECT analysis_id FROM job_user_analyses WHERE job_id=$1",
          [source],
        )
      ).map((r) => r.analysis_id);
      const parent = (
        await query(
          "SELECT t.id,t.project_id FROM jobs j JOIN target_posts t ON t.id=j.target_post_id WHERE j.id=$1",
          [source],
        )
      )[0];
      await query("DELETE FROM jobs WHERE id=$1", [source]);
      await query("DELETE FROM user_analyses WHERE id=ANY($1::text[])", [
        analyses,
      ]);
      await query("DELETE FROM target_posts WHERE id=$1", [parent.id]);
      await query("DELETE FROM projects WHERE id=$1", [parent.project_id]);
    }
  });
  it("atomically refuses competing charges over the cap and settles only once", async () => {
    const id = await registerCampaign(plan);
    try {
      const results = await Promise.allSettled([
        reserveCharge(id, "a", 1600),
        reserveCharge(id, "b", 1600),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const key = (
        await query("SELECT key FROM discovery_charges WHERE job_id=$1", [id])
      )[0].key;
      await reserveCharge(id, key, 1600);
      await settleCharge(id, key, 1000);
      await settleCharge(id, key, 1000);
      await expect(reserveCharge(id, "c", 2001)).rejects.toThrow(
        "BUDGET_LIMIT",
      );
      const j = (
        await query("SELECT * FROM discovery_jobs WHERE id=$1", [id])
      )[0];
      expect(j.spent_yen).toBe(1000);
      expect(j.reserved_yen).toBe(0);
      await reserveCharge(id, "d", 500);
      await settleCharge(id, "d", 600);
      expect(
        (await query("SELECT status FROM discovery_jobs WHERE id=$1", [id]))[0]
          .status,
      ).toBe("budget_stopped");
      await expect(reserveCharge(id, "after-stop", 0)).rejects.toThrow(
        "BUDGET_STOPPED",
      );
    } finally {
      await query("DELETE FROM discovery_jobs WHERE id=$1", [id]);
    }
  });
});
afterAll(async () => {
  await db.end();
});
