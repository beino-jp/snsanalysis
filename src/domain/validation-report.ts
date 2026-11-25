import { z } from "zod";
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
    costUsd: cost,
    cleanup: "deleted" as const,
    source: "local-probe-upload" as const,
    attributionStatus: "not_analyzed" as const,
  };
}
