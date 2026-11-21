import "dotenv/config";
import { ApifyClient } from "apify-client";
import { mkdir, writeFile } from "node:fs/promises";
import { validateUrl } from "../src/server/jobs";
const url = validateUrl(process.env.P0_POST_URL ?? "");
const actors = (process.env.P0_ACTORS ?? "").split(",").filter(Boolean);
const max = Number(process.env.P0_MAX_USD);
if (
  !process.env.APIFY_TOKEN ||
  !actors.length ||
  !Number.isFinite(max) ||
  max <= 0
)
  throw Error(
    "APIFY_TOKEN / P0_ACTORS / P0_MAX_USD must be configured explicitly",
  );
const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
const results: Record<string, unknown>[] = [];
for (const actor of actors) {
  const started = Date.now();
  let run:
    Awaited<ReturnType<ReturnType<typeof client.actor>["call"]>> | undefined;
  try {
    // Validate the actor input schema first. Optional per-actor overrides remain local env only.
    const overrides = JSON.parse(process.env.P0_INPUT_OVERRIDES ?? "{}");
    run = await client
      .actor(actor)
      .call(overrides[actor] ?? { postUrls: [url] }, {
        maxTotalChargeUsd: max / actors.length,
        build: process.env.APIFY_ACTOR_BUILD ?? "latest",
      });
    const unique = new Set<string>();
    let records = 0,
      privateCount = 0;
    for (let offset = 0; ; offset += 100) {
      const page = await client
        .dataset(run.defaultDatasetId)
        .listItems({ offset, limit: 100, clean: true });
      for (const raw of page.items) {
        const p = raw as Record<string, any>;
        records++;
        const id = p.userId ?? p.user_id ?? p.id ?? p.username;
        if (id) unique.add(String(id));
        if (p.is_private ?? p.isPrivate ?? p.private) privateCount++;
      }
      if (offset + page.items.length >= page.total) break;
    }
    results.push({
      actor,
      status: run.status,
      elapsedSeconds: (Date.now() - started) / 1000,
      records,
      uniqueUsers: unique.size,
      privateRecords: privateCount,
      costUsd: run.usageTotalUsd ?? null,
      usdPer1000Unique:
        unique.size && run.usageTotalUsd != null
          ? (run.usageTotalUsd / unique.size) * 1000
          : null,
      build: run.buildId,
    });
  } catch {
    results.push({
      actor,
      status: "FAILED",
      elapsedSeconds: (Date.now() - started) / 1000,
    });
  } finally {
    if (run) {
      for (const [store, id] of [
        ["dataset", run.defaultDatasetId],
        ["keyValueStore", run.defaultKeyValueStoreId],
        ["requestQueue", run.defaultRequestQueueId],
      ] as const) {
        if (id)
          await (client[store](id) as { delete: () => Promise<void> }).delete();
      }
      await client.run(run.id).delete();
    }
  }
}
await mkdir(".p0-results", { recursive: true });
await writeFile(
  `.p0-results/comparison-${Date.now()}.json`,
  JSON.stringify({ measuredAt: new Date().toISOString(), results }, null, 2),
);
console.table(results);
