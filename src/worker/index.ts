import { runDiscoveryTick } from "./discovery";
import "dotenv/config";
import { query } from "../server/db";
import { tickJob } from "./process";
import { safeError, assertConfiguration } from "../server/config";
import { cleanupExpired } from "./retention";
assertConfiguration();
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
let lastCleanup = 0;
console.log("Reach Insight worker ready");
while (!stopping) {
  try {
    if (Date.now() - lastCleanup > 3600000) {
      await cleanupExpired();
      lastCleanup = Date.now();
    }
    await runDiscoveryTick();
    const job = (
      await query(
        "UPDATE jobs SET lease_until=now()+interval '2 minutes' WHERE id=(SELECT id FROM jobs WHERE status IN ('queued','fetching','analyzing') AND next_attempt<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *",
      )
    )[0];
    if (job) {
      const heartbeat = setInterval(() => {
        void query(
          "UPDATE jobs SET lease_until=now()+interval '2 minutes' WHERE id=$1",
          [job.id],
        );
      }, 30000);
      try {
        await tickJob(job);
        await query(
          "UPDATE jobs SET lease_until=NULL,retries=0,error=NULL,next_attempt=now() WHERE id=$1",
          [job.id],
        );
      } catch {
        await query(
          "UPDATE jobs SET retries=retries+1,status=CASE WHEN retries>=4 THEN 'error' ELSE status END,error=$2,lease_until=NULL,next_attempt=now()+(LEAST(60,power(2,retries+1)) * interval '1 second') WHERE id=$1",
          [job.id, safeError()],
        );
      } finally {
        clearInterval(heartbeat);
      }
    }
  } catch {
    console.error("Worker: database connection or cleanup failed; retrying.");
  }
  await new Promise((r) => setTimeout(r, 250));
}
process.exit(0);
