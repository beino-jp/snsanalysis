import { createHash, randomUUID } from "node:crypto";
import { query, transaction } from "../server/db";
import { aggregateAll } from "../domain/aggregation";
import { scorePost, decideSkate } from "../domain/skate";
import {
  Analysis,
  Engagement,
  Post,
  Profile,
  Settings,
  Target,
} from "../domain/types";
import { MockDataProvider, MockLLMProvider } from "../providers/mock";
import { ApifyDataProvider } from "../providers/apify";
import { OpenAILLMProvider } from "../providers/openai";
import { sanitize } from "../server/privacy";
export async function tickJob(job: Record<string, any>) {
  const s = job.settings as Settings,
    reference = new Date(job.reference_at).toISOString();
  const data =
    job.provider === "mock"
      ? new MockDataProvider(reference)
      : new ApifyDataProvider(job.id);
  const llm =
    job.provider === "mock" ? new MockLLMProvider() : new OpenAILLMProvider();
  const target = (
    await query("SELECT payload FROM target_posts WHERE id=$1", [
      job.target_post_id,
    ])
  )[0].payload as Target;
  const tasks = await query(
    "SELECT * FROM job_tasks WHERE job_id=$1 AND done=false AND kind IN ('like','comment') ORDER BY kind",
    [job.id],
  );
  const cost = async (value: number | null, input = 0, output = 0) =>
    query(
      "UPDATE jobs SET cost=cost+$2,cost_unknown=cost_unknown OR $3,input_tokens=input_tokens+$4,output_tokens=output_tokens+$5 WHERE id=$1",
      [job.id, value ?? 0, value === null, input, output],
    );
  if (tasks.length) {
    const task = tasks[0];
    const page = await data.engagements(target, task.kind, task.cursor);
    await transaction(async (q) => {
      for (const e of page.items)
        await q(
          "INSERT INTO engagements VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
          [job.id, e.id, e.userId, e.type, JSON.stringify(e)],
        );
      await q(
        "UPDATE job_tasks SET cursor=$3,done=$4 WHERE job_id=$1 AND kind=$2",
        [job.id, task.kind, page.cursor, page.cursor === null],
      );
      await q(
        "UPDATE jobs SET status='fetching',stage='engagements',progress=LEAST(progress+5,30),cost=cost+$2,cost_unknown=cost_unknown OR $3 WHERE id=$1",
        [job.id, page.cost ?? 0, page.cost === null],
      );
    });
    return;
  }
  const pending = await query(
    "SELECT DISTINCT e.user_id FROM engagements e LEFT JOIN sns_users u ON u.job_id=e.job_id AND u.user_id=e.user_id LEFT JOIN job_user_analyses a ON a.job_id=e.job_id AND a.user_id=e.user_id WHERE e.job_id=$1 AND e.user_id<>$2 AND a.user_id IS NULL AND (u.user_id IS NULL OR (u.payload->>'private')::boolean=false) ORDER BY e.user_id LIMIT 1",
    [job.id, target.ownerId],
  );
  if (pending.length) {
    const userId = pending[0].user_id;
    await query(
      "UPDATE jobs SET status='analyzing',stage='profiles' WHERE id=$1",
      [job.id],
    );
    let profile = (
      await query(
        "SELECT payload FROM sns_users WHERE job_id=$1 AND user_id=$2",
        [job.id, userId],
      )
    )[0]?.payload as Profile | undefined;
    if (!profile) {
      profile = await data.profile(userId);
      await query(
        "INSERT INTO sns_users VALUES($1,$2,$3,now()) ON CONFLICT DO NOTHING",
        [job.id, userId, JSON.stringify(profile)],
      );
    }
    if (!profile.private) {
      const cacheKey = createHash("sha256")
        .update(
          JSON.stringify({
            settings: s,
            reference,
            provider: job.provider,
            model: job.model,
            prompt: job.prompt_version,
          }),
        )
        .digest("hex");
      let cached = (
        await query(
          "SELECT * FROM user_analyses WHERE user_id=$1 AND cache_key=$2 AND created_at>now()-($3 * interval '1 day') ORDER BY created_at DESC LIMIT 1",
          [userId, cacheKey, s.cacheDays],
        )
      )[0];
      if (!cached) {
        const kind = `posts:${userId}`;
        let task = (
          await query("SELECT * FROM job_tasks WHERE job_id=$1 AND kind=$2", [
            job.id,
            kind,
          ])
        )[0];
        if (!task) {
          await query("INSERT INTO job_tasks VALUES($1,$2,NULL,false)", [
            job.id,
            kind,
          ]);
          task = { cursor: null, done: false };
        }
        // Only engagement tasks belong to the outer dispatcher.
        if (!task.done) {
          const page = await data.posts(profile, reference, task.cursor);
          for (const p of page.items) {
            const signal = scorePost(p, reference, s);
            if (signal.candidate && !signal.excluded)
              p.visionObservation = await llm.vision(p);
          }
          await transaction(async (q) => {
            for (const p of page.items) {
              if (
                Date.parse(p.at) >= Date.parse(reference) - 365 * 86400000 &&
                Date.parse(p.at) <= Date.parse(reference)
              ) {
                await q(
                  "INSERT INTO user_posts VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
                  [job.id, userId, p.id, JSON.stringify(sanitize(p))],
                );
              }
            }
            await q(
              "UPDATE job_tasks SET cursor=$3,done=$4 WHERE job_id=$1 AND kind=$2",
              [job.id, kind, page.cursor, page.cursor === null],
            );
          });
          await cost(page.cost);
          // Only observations are persisted, never image URLs or bytes.
          if (page.cursor !== null) return;
          const posts = (
            await query(
              "SELECT payload FROM user_posts WHERE job_id=$1 AND user_id=$2",
              [job.id, userId],
            )
          ).map((r) => r.payload as Post);
          await analyze(posts);
        } else {
          const posts = (
            await query(
              "SELECT payload FROM user_posts WHERE job_id=$1 AND user_id=$2",
              [job.id, userId],
            )
          ).map((r) => r.payload as Post);
          await analyze(posts);
        }
        async function analyze(posts: Post[]) {
          const signals = posts.map((p) => scorePost(p, reference, s));
          const candidates = signals
            .filter((x) => x.candidate && !x.excluded)
            .map((x) => x.post);
          const vision: Record<
            string,
            "ice" | "spectating" | "skateboard" | "roller" | "none"
          > = {};
          for (const p of candidates)
            vision[p.id] = p.visionObservation ?? "none";
          const result = await llm.analyze(profile!, posts, candidates, s);
          await cost(result.cost, result.inputTokens, result.outputTokens);
          const skate = decideSkate(signals, vision, result.skate, s);
          const attributes = result.attributes;
          if (attributes.genderConfidence < s.confidence)
            attributes.gender = "不明";
          if (attributes.ageConfidence < s.confidence) attributes.age = "不明";
          for (const value of Object.values(attributes.interests))
            if (value.confidence < s.confidence) value.value = null;
          attributes.interests["スケート関心"] = {
            value:
              skate.result !== "no" ||
              skate.type === "観戦" ||
              profile!.bio.includes("スケート"),
            confidence: Math.max(skate.confidence, 0.6),
            reason: "体験・観戦または自己紹介",
            evidence: skate.evidence,
          };
          const a: Analysis = { ...attributes, userId, skate };
          const aid = randomUUID();
          await query("INSERT INTO user_analyses VALUES($1,$2,$3,$4,now())", [
            aid,
            userId,
            cacheKey,
            JSON.stringify(a),
          ]);
          cached = { id: aid };
        }
      }
      await query(
        "INSERT INTO job_user_analyses VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [job.id, userId, cached!.id],
      );
    }
    const done = Number(
        (
          await query("SELECT count(*) AS n FROM sns_users WHERE job_id=$1", [
            job.id,
          ])
        )[0].n,
      ),
      total = Number(
        (
          await query(
            "SELECT count(DISTINCT user_id) AS n FROM engagements WHERE job_id=$1 AND user_id<>$2",
            [job.id, target.ownerId],
          )
        )[0].n,
      );
    await query("UPDATE jobs SET progress=$2 WHERE id=$1", [
      job.id,
      30 + Math.floor((done / Math.max(total, 1)) * 65),
    ]);
    return;
  }
  const e = (
      await query("SELECT payload FROM engagements WHERE job_id=$1", [job.id])
    ).map((r) => r.payload as Engagement),
    p = (
      await query("SELECT payload FROM sns_users WHERE job_id=$1", [job.id])
    ).map((r) => r.payload as Profile),
    a = (
      await query(
        "SELECT a.payload FROM job_user_analyses ja JOIN user_analyses a ON a.id=ja.analysis_id WHERE ja.job_id=$1",
        [job.id],
      )
    ).map((r) => r.payload as Analysis);
  await query(
    "INSERT INTO aggregates VALUES($1,$2) ON CONFLICT(job_id) DO UPDATE SET payload=excluded.payload",
    [
      job.id,
      JSON.stringify(
        aggregateAll(e, p, a, target.ownerId, target.likes, target.comments),
      ),
    ],
  );
  if (data instanceof ApifyDataProvider) await data.cleanupFinished();
  await query(
    "UPDATE jobs SET status='completed',stage='complete',progress=100,completed_at=now() WHERE id=$1",
    [job.id],
  );
}
