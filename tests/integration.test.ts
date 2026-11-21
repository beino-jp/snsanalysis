import { describe, it, expect, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { query, db } from "../src/server/db";
import { createJob, jobDetail } from "../src/server/jobs";
import { tickJob } from "../src/worker/process";
import { DEMO_URL } from "../src/fixtures/demo";
import { MockDataProvider } from "../src/providers/mock";
import { deleteExpiredJob } from "../src/worker/retention";
const enabled = process.env.RUN_DB_TESTS === "true";
describe.skipIf(!enabled)("mock pipeline with PostgreSQL", () => {
  it("registers, resumes after a checkpoint, analyzes and aggregates without external APIs", async () => {
    const id = await createJob({
      url: DEMO_URL,
      project: "test-" + randomUUID(),
      reference: "execution",
    });
    try {
      let job = (await query("SELECT * FROM jobs WHERE id=$1", [id]))[0];
      await tickJob(job);
      const count = (
        await query("SELECT count(*) AS n FROM engagements WHERE job_id=$1", [
          id,
        ])
      )[0].n;
      expect(Number(count)).toBeGreaterThan(0);
      const before = await query(
        "SELECT * FROM job_tasks WHERE job_id=$1 ORDER BY kind",
        [id],
      );
      const failure = vi
        .spyOn(MockDataProvider.prototype, "engagements")
        .mockRejectedValueOnce(new Error("temporary failure"));
      await expect(
        tickJob((await query("SELECT * FROM jobs WHERE id=$1", [id]))[0]),
      ).rejects.toThrow("temporary failure");
      failure.mockRestore();
      expect(
        await query("SELECT * FROM job_tasks WHERE job_id=$1 ORDER BY kind", [
          id,
        ]),
      ).toEqual(before);
      // New process state reconstructed only from durable checkpoints.
      for (let i = 0; i < 100; i++) {
        job = (await query("SELECT * FROM jobs WHERE id=$1", [id]))[0];
        if (job.status === "completed") break;
        await tickJob(job);
      }
      const detail = await jobDetail(id);
      expect(detail?.status).toBe("completed");
      expect(detail?.analyzedUsers).toHaveLength(42);
      expect(
        detail?.analyzedUsers.filter((u: { reactions: string[] }) =>
          u.reactions.includes("like"),
        ),
      ).toHaveLength(37);
      expect(
        detail?.analyzedUsers.filter((u: { reactions: string[] }) =>
          u.reactions.includes("comment"),
        ),
      ).toHaveLength(21);
      expect(
        detail?.analyzedUsers.find((u: { masked: boolean }) => u.masked)
          ?.profileUrl,
      ).toBeNull();
      expect(detail?.aggregates.unique).toMatchObject({
        total: 48,
        private: 6,
        analyzed: 42,
        failed: 0,
      });
      expect(detail?.aggregates.like.total).toBe(42);
      expect(detail?.aggregates.comment.total).toBe(24);
      expect(detail?.aggregates.comment.records).toBe(28);
      expect(
        detail?.highInterest.some(
          (u: { name: string }) => u.name === "非表示（10代）",
        ),
      ).toBe(true);
      const texts = await query(
        "SELECT payload FROM user_posts WHERE job_id=$1",
        [id],
      );
      expect(
        texts.every((r) => !JSON.stringify(r.payload).includes("imageUrls")),
      ).toBe(true);
      const privatePosts = await query(
        "SELECT p.* FROM user_posts p JOIN sns_users u ON p.user_id=u.user_id AND p.job_id=u.job_id WHERE p.job_id=$1 AND (u.payload->>'private')::boolean=true",
        [id],
      );
      expect(privatePosts.length).toBe(0);
    } finally {
      const refs = await query(
        "SELECT analysis_id FROM job_user_analyses WHERE job_id=$1",
        [id],
      );
      const parent = (
        await query(
          "SELECT t.id,t.project_id FROM jobs j JOIN target_posts t ON t.id=j.target_post_id WHERE j.id=$1",
          [id],
        )
      )[0];
      await query("DELETE FROM jobs WHERE id=$1", [id]);
      await query("DELETE FROM user_analyses WHERE id=ANY($1::text[])", [
        refs.map((r) => r.analysis_id),
      ]);
      await query("DELETE FROM target_posts WHERE id=$1", [parent.id]);
      await query("DELETE FROM projects WHERE id=$1", [parent.project_id]);
    }
  }, 30000);
  it("expires only eligible jobs and cascades private records", async () => {
    const id = await createJob({
      url: DEMO_URL,
      project: "retention-test",
      reference: "execution",
    });
    expect(await deleteExpiredJob(id)).toBe(false);
    await query("INSERT INTO raw_payloads VALUES($1,'test','0',$2,now())", [
      id,
      JSON.stringify({ caption: "private text" }),
    ]);
    await query(
      "UPDATE jobs SET created_at=now()-interval '91 days' WHERE id=$1",
      [id],
    );
    expect(await deleteExpiredJob(id)).toBe(true);
    expect(await query("SELECT 1 FROM jobs WHERE id=$1", [id])).toHaveLength(0);
    expect(
      await query("SELECT 1 FROM raw_payloads WHERE job_id=$1", [id]),
    ).toHaveLength(0);
    expect(
      await query("SELECT 1 FROM job_tasks WHERE job_id=$1", [id]),
    ).toHaveLength(0);
  });
});
afterAll(async () => {
  await db.end();
});
