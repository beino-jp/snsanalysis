import { Post, Settings, Skate } from "./types";
export type Signal = {
  post: Post;
  score: number;
  excluded: boolean;
  spectating: boolean;
  candidate: boolean;
  reason: string;
};
const norm = (s: string) => s.normalize("NFKC").toLowerCase();
export function scorePost(post: Post, reference: string, s: Settings): Signal {
  const at = Date.parse(post.at),
    ref = Date.parse(reference);
  const text = norm(
    post.caption + " " + post.hashtags.join(" ") + " " + (post.location ?? ""),
  );
  const excluded =
    !Number.isFinite(at) ||
    at > ref ||
    at < ref - 365 * 86400000 ||
    s.exclusions.some((k) => text.includes(norm(k))) ||
    (!s.includeRoller && text.includes("ローラースケート"));
  if (excluded)
    return {
      post,
      score: 0,
      excluded: true,
      spectating: false,
      candidate: false,
      reason: "対象期間外または除外対象",
    };
  const caption = s.keywords.some((k) => norm(post.caption).includes(norm(k)));
  const spectating = s.spectators.some((k) => text.includes(norm(k)));
  const score =
    (s.rinks.some((k) => norm(post.location ?? "") === norm(k))
      ? s.weights.location
      : 0) +
    (post.hashtags.some((t) =>
      s.hashtags.some((k) => norm(k) === norm(t.replace(/^#/, ""))),
    )
      ? s.weights.hashtag
      : 0) +
    (caption ? s.weights.caption : 0) +
    (caption && s.experience.some((k) => norm(post.caption).includes(norm(k)))
      ? s.weights.experience
      : 0);
  return {
    post,
    score,
    excluded: false,
    spectating,
    candidate: score > 0 || (s.captionlessVision && !post.caption.trim()),
    reason: spectating ? "観戦候補" : "体験候補",
  };
}
export function decideSkate(
  signals: Signal[],
  vision: Record<
    string,
    "ice" | "spectating" | "skateboard" | "roller" | "none"
  >,
  ai: {
    result: "went" | "maybe" | "no";
    confidence: number;
    reason: string;
    evidence: string[];
  },
  s: Settings,
): Skate {
  const valid = signals.filter(
    (x) =>
      x.candidate &&
      !x.excluded &&
      vision[x.post.id] !== "skateboard" &&
      (s.includeRoller || vision[x.post.id] !== "roller"),
  );
  const experiences = valid.filter(
    (x) => !x.spectating && vision[x.post.id] !== "spectating",
  );
  const scored = experiences
    .map((x) => ({
      ...x,
      total: x.score + (vision[x.post.id] === "ice" ? s.weights.vision : 0),
    }))
    .sort((a, b) => b.total - a.total);
  const best = scored.find((x) => ai.evidence.includes(x.post.id)) ?? scored[0];
  const base = {
    result: "no" as const,
    type: "その他" as const,
    score: best?.total ?? 0,
    confidence: ai.confidence,
    evidence: [] as string[],
    reason: ai.reason,
  };
  // AI must cite a retained candidate. Scores cannot override explicit negative AI or low confidence.
  if (
    ai.confidence >= s.confidence &&
    ai.result !== "no" &&
    best &&
    ai.evidence.includes(best.post.id)
  ) {
    const result =
      best.total >= s.high && ai.result === "went"
        ? "went"
        : best.total >= s.medium || ai.result === "maybe"
          ? "maybe"
          : "no";
    if (result !== "no")
      return { ...base, result, type: "体験", evidence: [best.post.id] };
  }
  const spectator = valid.find(
    (x) => x.spectating || vision[x.post.id] === "spectating",
  );
  if (spectator)
    return {
      ...base,
      type: "観戦",
      score: spectator.score,
      evidence: [spectator.post.id],
      reason: "観戦の根拠を検出。滑走体験には含めません",
    };
  if (
    signals.some((x) =>
      s.exclusions.some((k) =>
        norm(x.post.caption + " " + x.post.hashtags.join(" ")).includes(
          norm(k),
        ),
      ),
    )
  )
    return {
      ...base,
      type: "スケボー",
      reason: "スケートボードは体験集計から除外",
    };
  return base;
}
