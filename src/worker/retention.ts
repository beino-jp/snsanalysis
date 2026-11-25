import { query, transaction } from "../server/db";
import { ApifyDataProvider } from "../providers/apify";
export async function deleteExpiredJob(id: string) {
  const job = (
    await query(
      "SELECT j.*,t.project_id FROM jobs j JOIN target_posts t ON t.id=j.target_post_id WHERE j.id=$1 AND j.created_at < now()-(COALESCE((j.settings->>'retentionDays')::int,90)*interval '1 day')",
      [id],
    )
  )[0];
  if (!job) return false;
  if ((await query("SELECT 1 FROM provider_runs WHERE job_id=$1", [id])).length)
    await new ApifyDataProvider(id).cleanupFinished();
  await transaction(async (q) => {
    const analysisIds = (
      await q("SELECT analysis_id FROM job_user_analyses WHERE job_id=$1", [id])
    ).map((r) => r.analysis_id);
    await q("DELETE FROM jobs WHERE id=$1", [id]);
    await q(
      "DELETE FROM user_analyses a WHERE a.id=ANY($1::text[]) AND a.created_at<now()-interval '90 days' AND NOT EXISTS(SELECT 1 FROM job_user_analyses ja WHERE ja.analysis_id=a.id)",
      [analysisIds],
    );
    await q(
      "DELETE FROM target_posts t WHERE t.id=$1 AND NOT EXISTS(SELECT 1 FROM jobs j WHERE j.target_post_id=t.id)",
      [job.target_post_id],
    );
    await q(
      "DELETE FROM projects p WHERE p.id=$1 AND NOT EXISTS(SELECT 1 FROM target_posts t WHERE t.project_id=p.id)",
      [job.project_id],
    );
  });
  return true;
}
export async function cleanupExpired() {
  await query(
    "DELETE FROM validation_reports WHERE created_at<now()-interval '90 days'",
  );
  await query(
    "DELETE FROM discovery_jobs WHERE created_at<now()-interval '90 days'",
  );
  const expired = await query(
    "SELECT id FROM jobs WHERE created_at<now()-(COALESCE((settings->>'retentionDays')::int,90)*interval '1 day')",
  );
  for (const job of expired) await deleteExpiredJob(job.id);
  await query(
    "DELETE FROM user_analyses a WHERE a.created_at<now()-interval '90 days' AND NOT EXISTS(SELECT 1 FROM job_user_analyses ja WHERE ja.analysis_id=a.id)",
  );
}
