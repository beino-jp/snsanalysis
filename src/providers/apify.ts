import { ApifyClient } from "apify-client";
import { DataProvider, Page } from "./interfaces";
import { Engagement, Post, Profile, Target } from "../domain/types";
import { query } from "../server/db";
import { sanitize } from "../server/privacy";
export class ApifyDataProvider implements DataProvider {
  name = "apify";
  private client: ApifyClient;
  constructor(private jobId: string) {
    if (!process.env.APIFY_TOKEN) throw Error("APIFY_TOKEN未設定");
    this.client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  }
  private async actor(
    key: string,
    actor: string | undefined,
    input: Record<string, unknown>,
    cursor: string | null,
  ): Promise<Page<Record<string, any>>> {
    if (!actor)
      throw Error("Actor未選択。P0比較後に環境変数で指定してください");
    let saved = (
      await query("SELECT * FROM provider_runs WHERE job_id=$1 AND key=$2", [
        this.jobId,
        key,
      ])
    )[0];
    if (saved?.payload?.finished) return { items: [], cursor: null, cost: 0 };
    if (!saved) {
      const run = await this.client
        .actor(actor)
        .start(input, {
          build: process.env.APIFY_ACTOR_BUILD ?? "latest",
          memory: 512,
        });
      await query(
        "INSERT INTO provider_runs VALUES($1,$2,$3,NULL) ON CONFLICT DO NOTHING",
        [this.jobId, key, run.id],
      );
      saved = { run_id: run.id };
    }
    const run = await this.client
      .run(saved.run_id)
      .waitForFinish({ waitSecs: 5 });
    if (!run || !["SUCCEEDED"].includes(run.status)) {
      if (run && ["FAILED", "ABORTED", "TIMED-OUT"].includes(run.status))
        throw Error("Apify取得失敗");
      throw Error("Apify処理待ち");
    }
    const offset = Number(cursor ?? 0);
    const result = await this.client
      .dataset(run.defaultDatasetId)
      .listItems({ offset, limit: 100, clean: true });
    const next =
      offset + result.items.length < result.total
        ? String(offset + result.items.length)
        : null;
    // Only scrubbed JSON enters our database. Dataset deletion is deferred until page commit.
    return {
      items: result.items as Record<string, any>[],
      cursor: next,
      cost: offset === 0 ? (run.usageTotalUsd ?? null) : 0,
    };
  }
  async cleanupFinished() {
    for (const row of await query(
      "SELECT * FROM provider_runs WHERE job_id=$1",
      [this.jobId],
    )) {
      const run = await this.client.run(row.run_id).get();
      if (!run) continue;
      for (const [store, id] of [
        ["dataset", run.defaultDatasetId],
        ["keyValueStore", run.defaultKeyValueStoreId],
        ["requestQueue", run.defaultRequestQueueId],
      ] as const) {
        if (id)
          await (
            this.client[store](id) as { delete: () => Promise<void> }
          ).delete();
      }
      await this.client.run(row.run_id).delete();
      await query("DELETE FROM provider_runs WHERE job_id=$1 AND key=$2", [
        this.jobId,
        row.key,
      ]);
    }
  }
  async target(url: string): Promise<Target> {
    const page = await this.actor(
      "target",
      process.env.APIFY_POSTS_ACTOR ?? "apify/instagram-post-scraper",
      { username: [url], resultsLimit: 1 },
      null,
    );
    const p = page.items[0];
    if (!p?.id || !p.ownerUsername) throw Error("公開投稿を取得できません");
    return {
      id: String(p.id),
      url,
      ownerId: String(p.ownerId ?? p.ownerUsername),
      owner: String(p.ownerUsername),
      postedAt: p.timestamp,
      likes: Number(p.likesCount ?? 0),
      comments: Number(p.commentsCount ?? 0),
      caption: p.caption ?? "",
    };
  }
  async engagements(
    target: Target,
    type: "like" | "comment",
    cursor: string | null,
  ): Promise<Page<Engagement>> {
    const actor =
      type === "like"
        ? process.env.APIFY_LIKERS_ACTOR
        : (process.env.APIFY_COMMENTS_ACTOR ??
          "apify/instagram-comment-scraper");
    // Likers input is actor-specific. P0 must validate this contract before selecting a different actor.
    const input =
      type === "like"
        ? { postUrls: [target.url] }
        : { directUrls: [target.url], includeNestedComments: true };
    const page = await this.actor(type, actor, input, cursor);
    const items: Engagement[] = [];
    const append = (r: Record<string, any>) => {
      const owner = r.owner ?? r;
      const uid =
        owner.id ?? r.userId ?? r.user_id ?? owner.username ?? r.username;
      if (!uid) return;
      items.push({
        id: type === "comment" ? String(r.id) : `like-${uid}`,
        userId: String(uid),
        type,
        ...(type === "comment"
          ? { text: String(r.text ?? ""), at: r.timestamp }
          : {}),
      });
    };
    for (const row of page.items) {
      append(row);
      if (type === "comment")
        for (const reply of row.replies ?? []) append(reply);
    }
    await query(
      "INSERT INTO raw_payloads VALUES($1,$2,$3,$4,now()) ON CONFLICT DO NOTHING",
      [this.jobId, type, cursor ?? "0", JSON.stringify(sanitize(page.items))],
    );
    return { ...page, items };
  }
  async profile(id: string): Promise<Profile> {
    const page = await this.actor(
      `profile:${id}`,
      process.env.APIFY_PROFILE_ACTOR ?? "apify/instagram-profile-scraper",
      { usernames: [id] },
      null,
    );
    const p = page.items[0];
    if (!p?.username) throw Error("プロフィール未取得");
    return {
      id,
      username: p.username,
      displayName: p.fullName ?? "",
      bio: p.biography ?? "",
      private: !!p.private,
      followers: p.followersCount,
      following: p.followsCount,
      postCount: p.postsCount,
      business: p.isBusinessAccount,
      category: p.businessCategoryName,
      externalUrl: p.externalUrl,
    };
  }
  async posts(
    p: Profile,
    reference: string,
    cursor: string | null,
  ): Promise<Page<Post>> {
    if (p.private) throw Error("鍵アカの投稿取得は禁止");
    const page = await this.actor(
      `posts:${p.id}`,
      process.env.APIFY_POSTS_ACTOR ?? "apify/instagram-post-scraper",
      {
        username: [p.username],
        onlyPostsNewerThan: new Date(
          Date.parse(reference) - 365 * 86400000,
        ).toISOString(),
      },
      cursor,
    );
    return {
      ...page,
      items: page.items.map((r) => ({
        id: String(r.id),
        url: r.url ?? `https://www.instagram.com/p/${r.shortCode}/`,
        at: r.timestamp,
        caption: r.caption ?? "",
        hashtags: r.hashtags ?? [],
        location: r.locationName,
        mentions: r.mentions ?? [],
        imageUrls: (r.childPosts?.length
          ? r.childPosts.map((x: Record<string, any>) => x.displayUrl)
          : [r.displayUrl]
        ).filter(Boolean),
      })),
    };
  }
}
