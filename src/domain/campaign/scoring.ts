import type { Analysis } from "../types";
import type { Candidate, CandidateScore, Plan, ScorePart } from "./types";
const norm = (s: string) => s.normalize("NFKC").toLowerCase();
const tokens = (s: string) =>
  norm(s)
    .split(/[\s、,・\/]+/)
    .filter((t) => t.length > 0);
export function scoreCandidate(
  c: Candidate,
  p: Plan,
  reference: string,
): CandidateScore {
  const excluded = c.private
    ? "鍵アカウント"
    : c.minor
      ? "未成年の可能性があるアカウント"
      : null;
  const posts = c.posts
    .filter((post) => Date.parse(post.at) <= Date.parse(reference))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 20);
  const text = norm(c.bio + " " + posts.map((x) => x.caption).join(" "));
  const topicTokens = tokens(p.goal.topic),
    matched = posts.filter((x) => {
      const text = norm(x.caption);
      if (
        /スケート/.test(p.goal.topic) &&
        !/スケートボード|スケボー|ローラー/.test(p.goal.topic) &&
        /スケボー|スケートボード|skateboard|スケートパーク|ローラースケート/.test(
          text,
        )
      )
        return false;
      return topicTokens.some((t) => text.includes(t));
    });
  const audienceTokens = [
    ...p.goal.targetTags.map((t) => (t === "子持ち" ? "子育て" : t)),
    ...tokens(p.goal.audience),
  ].filter((t) => t.length >= 2);
  const audienceMatch = audienceTokens.some((t) => text.includes(norm(t)));
  const region =
    p.goal.region === "全国"
      ? 1
      : text.includes(norm(p.goal.region))
        ? 1
        : null;
  const recent = posts.filter(
    (x) => Date.parse(x.at) >= Date.parse(reference) - 30 * 86400000,
  ).length;
  const measured = posts.filter((x) => x.likes !== null && x.comments !== null);
  const ratios =
    c.followers && c.followers > 0
      ? measured
          .map((x) => (x.likes! + x.comments!) / c.followers!)
          .sort((a, b) => a - b)
      : [];
  const median = ratios.length
    ? (ratios[Math.floor((ratios.length - 1) / 2)] +
        ratios[Math.ceil((ratios.length - 1) / 2)]) /
      2
    : null;
  const parts: ScorePart[] = [
    {
      id: "topic",
      label: "発信テーマとの一致",
      weight: 40,
      value: posts.length
        ? Math.min(1, matched.length / Math.max(3, posts.length * 0.4))
        : null,
      points: null,
      reason: posts.length
        ? `直近${posts.length}投稿のうち${matched.length}投稿が「${p.goal.topic}」に言及`
        : "公開投稿の情報が不足",
      evidence: matched.slice(0, 3).map((x) => x.id),
    },
    {
      id: "audience",
      label: "対象層に関連する発信",
      weight: 25,
      value: posts.length ? (audienceMatch ? 1 : 0) : null,
      points: null,
      reason: audienceMatch
        ? "自己紹介・投稿に対象層に関連する記述あり。反応ユーザーの属性を示すものではありません"
        : "対象層に関連する発信の根拠を確認できません",
      evidence: posts
        .filter((x) =>
          audienceTokens.some((t) => norm(x.caption).includes(norm(t))),
        )
        .slice(0, 3)
        .map((x) => x.id),
    },
    {
      id: "region",
      label: "対象エリアとの関連",
      weight: 15,
      value: region,
      points: null,
      reason:
        p.goal.region === "全国"
          ? "地域の限定なし"
          : region === 1
            ? `自己紹介・投稿に「${p.goal.region}」の記述あり`
            : "対象エリアに関する記述なし。活動地域は不明",
      evidence: [],
    },
    {
      id: "activity",
      label: "最近の発信活動",
      weight: 10,
      value: posts.length ? Math.min(1, recent / 4) : null,
      points: null,
      reason: `直近30日で${recent}投稿。月4投稿を目安として評価`,
      evidence: [],
    },
    {
      id: "engagement",
      label: "投稿への反応",
      weight: 10,
      value: median === null ? null : Math.min(1, median / 0.03),
      points: null,
      reason:
        median === null
          ? "いいね・コメント数またはフォロワー数が不足"
          : `投稿反応率の中央値 ${(median * 100).toFixed(1)}%。3%を目安として評価。業界平均ではありません`,
      evidence: [],
    },
  ];
  for (const part of parts)
    part.points =
      part.value === null
        ? null
        : Math.round(part.value * part.weight * 10) / 10;
  const coverage =
    parts.reduce((n, x) => n + (x.value === null ? 0 : x.weight), 0) / 100;
  const total = Math.round(parts.reduce((n, x) => n + (x.points ?? 0), 0));
  // Missing evidence is never silently renormalized to a perfect score.
  const score = excluded || coverage < 0.7 ? null : total;
  const topicEvidence = matched.length > 0;
  return {
    score,
    coverage,
    maxPossible: Math.min(100, total + Math.round((1 - coverage) * 100)),
    label: excluded
      ? "対象外"
      : score === null
        ? "判定材料不足"
        : score >= 80
          ? "適合度が高い"
          : score >= p.recommendThreshold
            ? "候補として検討"
            : "適合度が低い",
    parts,
    eligible:
      !excluded &&
      score !== null &&
      score >= p.recommendThreshold &&
      topicEvidence,
    excluded,
  };
}
export function rankCandidates(
  items: { candidate: Candidate; assessment: CandidateScore }[],
) {
  const seen = new Set<string>();
  return items
    .filter((x) => x.assessment.eligible)
    .sort(
      (a, b) =>
        (b.assessment.score ?? 0) - (a.assessment.score ?? 0) ||
        b.assessment.coverage - a.assessment.coverage ||
        a.candidate.username.localeCompare(b.candidate.username),
    )
    .filter((x) => {
      const key = norm(x.candidate.username);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}
export function scoreReach(analyses: Analysis[], p: Plan) {
  const n = analyses.length;
  const parts = p.criteria.map((c) => {
    const topicTag = /スケート/.test(p.goal.topic)
      ? "スケート関心"
      : /犬/.test(p.goal.topic)
        ? "犬好き"
        : null;
    let matches = 0,
      unknown = 0;
    for (const a of analyses) {
      if (c.id === "age") {
        if (a.age === "不明") unknown++;
        else if (p.goal.ages.includes(a.age as (typeof p.goal.ages)[number]))
          matches++;
      } else {
        const wanted =
          c.id === "audience" ? p.goal.targetTags : topicTag ? [topicTag] : [];
        const flags = wanted.map((t) => a.interests[t]?.value ?? null);
        if (!wanted.length || flags.every((x) => x === null)) unknown++;
        else if (flags.some((x) => x === true)) matches++;
        else if (flags.some((x) => x === null)) unknown++;
      }
    }
    const rate = n ? matches / n : 0;
    return {
      ...c,
      matches,
      unknown,
      rate,
      points:
        n && unknown < n
          ? Math.round(Math.min(1, rate / c.target) * c.weight * 10) / 10
          : null,
    };
  });
  const coverage =
    n && parts.length
      ? parts.reduce((v, x) => v + x.weight * (1 - x.unknown / n), 0) / 100
      : 0;
  const total = Math.round(parts.reduce((v, c) => v + (c.points ?? 0), 0));
  return {
    score: coverage >= 0.7 && n >= 30 ? total : null,
    coverage,
    denominator: n,
    label:
      coverage < 0.7 || n < 30
        ? "判定材料不足"
        : total >= 80
          ? "設定目標をおおむね達成"
          : total >= 50
            ? "改善の余地あり"
            : "設定目標への到達が少ない",
    parts,
    notice:
      "分析済み公開アカウントを分母に評価。不明を含みます。来場・売上の実績評価ではありません。",
  };
}
