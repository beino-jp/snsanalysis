import { Analysis, Engagement, Profile } from "./types";
export type Group = ReturnType<typeof aggregateGroup>;
export function aggregateGroup(
  engagements: Engagement[],
  profiles: Profile[],
  analyses: Analysis[],
  ownerId: string,
  kind: "like" | "comment" | "unique",
  displayed?: number,
) {
  const rows = engagements.filter(
    (e) => e.userId !== ownerId && (kind === "unique" || e.type === kind),
  );
  const ids = [...new Set(rows.map((e) => e.userId))];
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const users = ids
    .map((id) => profileById.get(id))
    .filter((p): p is Profile => !!p);
  const publicIds = new Set(users.filter((p) => !p.private).map((p) => p.id));
  const results = analyses.filter((a) => publicIds.has(a.userId));
  const count = (values: string[]) => {
    const counts: Record<string, number> = {};
    for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  };
  const comments = rows.filter((e) => e.type === "comment").length;
  return {
    total: ids.length,
    records: rows.length,
    displayed: displayed ?? null,
    acquisition: displayed
      ? (kind === "comment" ? comments : ids.length) / displayed
      : null,
    private: users.filter((p) => p.private).length,
    analyzed: results.length,
    failed: ids.length - users.filter((p) => p.private).length - results.length,
    gender: count(results.map((a) => a.gender)),
    age: count(results.map((a) => a.age)),
    cross: count(results.map((a) => `${a.gender}・${a.age}`)),
    interests: count(
      results.flatMap((a) =>
        Object.entries(a.interests)
          .filter(([, v]) => v.value === true)
          .map(([k]) => k),
      ),
    ),
    skate: count(
      results.map((a) =>
        a.skate.result === "went"
          ? "行った（確度高）"
          : a.skate.result === "maybe"
            ? "可能性あり"
            : a.skate.type === "観戦"
              ? "観戦"
              : "該当なし",
      ),
    ),
    highInterest: results.filter((a) => a.skate.result === "went").length,
  };
}
export function aggregateAll(
  e: Engagement[],
  p: Profile[],
  a: Analysis[],
  owner: string,
  likes: number,
  comments: number,
) {
  return {
    like: aggregateGroup(e, p, a, owner, "like", likes),
    comment: aggregateGroup(e, p, a, owner, "comment", comments),
    unique: aggregateGroup(e, p, a, owner, "unique"),
  };
}
export const percent = (count: number, denominator: number) =>
  denominator > 0 ? Math.round((count / denominator) * 1000) / 10 : 0;
