import { z } from "zod";
import { audienceCoverage } from "../../scripts/lib/audience-coverage.mjs";
import { audienceSchema } from "./audience";
const count = z.number().int().min(0).max(1e9);
const base = {
  status: z.literal("verified"),
  cleanup: z.literal("deleted"),
  costUsd: z.number().finite().min(0).max(0.1),
};
const post = z.object({
  ...base,
  key: z.literal("post"),
  actor: z.literal("apify/instagram-scraper"),
  summary: z.object({
    postRecords: z.literal(1),
    displayedLikes: count,
    displayedComments: count,
  }),
});
const comments = z.object({
  ...base,
  key: z.literal("comments"),
  actor: z.literal("apify/instagram-comment-scraper"),
  summary: z.object({
    commentRecords: count.max(20),
    uniqueCommenters: count.max(20),
  }),
});
const journal = z.object({
  status: z.literal("completed"),
  startedAt: z.string().datetime(),
  comments: z.array(z.object({username: z.string().regex(/^[A-Za-z0-9_.]{1,30}$/).nullable(), text: z.string().max(4000)})).max(20).optional(),
  audience: audienceSchema.optional(),
  profileInputs: z.array(z.object({
    username: z.string().regex(/^[A-Za-z0-9_.]{1,30}$/),
    private: z.boolean().optional(), isPrivate: z.boolean().optional(),
    biography: z.string().max(2000).optional(),
    latestPosts: z.array(z.object({caption:z.string().max(400)})).max(20).optional(),
  })).max(20).optional(),
  runs: z.array(z.discriminatedUnion("key", [post, comments])).length(2),
});
export type ValidationReport = ReturnType<typeof parseValidationReport>;
export function parseValidationReport(raw: unknown, url: string) {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    !["instagram.com", "www.instagram.com"].includes(u.hostname) ||
    !/^\/p\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)
  )
    throw Error("Instagram投稿URLを入力してください");
  const data = journal.parse(raw),
    p = data.runs.find((r) => r.key === "post"),
    c = data.runs.find((r) => r.key === "comments");
  if (!p || !c || p.key !== "post" || c.key !== "comments")
    throw Error("投稿情報とコメントの完了記録が必要です");
  if (c.summary.uniqueCommenters > c.summary.commentRecords)
    throw Error("ユニーク人数が取得件数を超えています");
  if (data.comments && data.comments.length !== c.summary.commentRecords) throw Error("コメント件数が記録と一致しません");
  if(data.audience){
    const names=new Set(data.comments?.map(c=>c.username));
    const people=data.audience.people;
    if(new Set(people.map(p=>p.username)).size!==people.length || people.some(p=>!names.has(p.username))) throw Error("属性の対象が取得記録と一致しません");
  }
  const cost = data.runs.reduce((n, r) => n + r.costUsd, 0);
  if (cost > 0.10000001) throw Error("検証の課金枠を超えています");
  return {
    url: `https://www.instagram.com${u.pathname.replace(/\/?$/, "/")}`,
    startedAt: data.startedAt,
    displayedLikes: p.summary.displayedLikes,
    displayedComments: p.summary.displayedComments,
    commentRecords: c.summary.commentRecords,
    uniqueCommenters: c.summary.uniqueCommenters,
    commentAcquisition:
      p.summary.displayedComments > 0
        ? c.summary.commentRecords / p.summary.displayedComments
        : null,
    comments: data.comments?.map(c => ({...c, profileUrl: c.username ? `https://www.instagram.com/${c.username}/` : null})),
    audience: data.audience,
    coverage: data.audience && data.profileInputs ? audienceCoverage(data) : null,
    costUsd: cost,
    cleanup: "deleted" as const,
    source: "local-probe-upload" as const,
    attributionStatus: data.audience ? "analyzed" as const : "not_analyzed" as const,
  };
}
