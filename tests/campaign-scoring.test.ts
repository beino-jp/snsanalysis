import { it, expect } from "vitest";
import { planGoal } from "../src/domain/campaign/plan";
import { GoalSchema, PlanSchema } from "../src/domain/campaign/types";
import type { Candidate, Goal } from "../src/domain/campaign/types";
import type { Analysis } from "../src/domain/types";
import {
  scoreCandidate,
  rankCandidates,
  scoreReach,
} from "../src/domain/campaign/scoring";
import { canReserve, projectedYen } from "../src/domain/campaign/budget";
const goal = GoalSchema.parse({
  purpose: "東京でカップルにスケートを紹介して集客したい",
  ages: ["20代", "30代"],
});
const plan = planGoal(goal).plan!;
const reference = "2026-11-21T12:00:00Z";
const candidate: Candidate = {
  id: "c",
  username: "creator",
  name: "テスト",
  bio: "東京でカップルとスケート",
  followers: 10000,
  private: false,
  minor: false,
  profileUrl: "",
  demo: true,
  posts: Array.from({ length: 20 }, (_, i) => ({
    id: `p${i}`,
    url: "",
    at: new Date(Date.parse(reference) - i * 86400000).toISOString(),
    caption: "東京でカップルとスケート",
    likes: 300,
    comments: 10,
  })),
};
it("asks only for missing campaign conditions and accepts a concrete objective", () => {
  const missing = planGoal(
    GoalSchema.parse({ purpose: "イベントを盛り上げたい" }),
  );
  expect(missing.plan).toBeNull();
  expect(missing.questions.map((q) => q.field)).toEqual([
    "objective",
    "audience",
    "region",
    "topic",
  ]);
  expect(plan.goal).toMatchObject({
    objective: "visits",
    region: "東京",
    topic: "スケート",
    targetTags: ["カップル"],
  });
  expect(plan.criteria.reduce((n, c) => n + c.weight, 0)).toBe(100);
});
it("rejects sensitive evaluation conditions and invalid weighting", () => {
  expect(() =>
    planGoal(GoalSchema.parse({ purpose: "宗教や支持政党で選定したい" })),
  ).toThrow();
  expect(() =>
    PlanSchema.parse({
      ...plan,
      criteria: plan.criteria.map((c) => ({ ...c, weight: 100 })),
    }),
  ).toThrow();
  expect(() =>
    PlanSchema.parse({
      ...plan,
      criteria: [plan.criteria[0], plan.criteria[0]],
    }),
  ).toThrow();
});
it("scores observed content with inspectable evidence, not audience demographics", () => {
  const s = scoreCandidate(candidate, plan, reference);
  expect(s.score).toBe(100);
  expect(s.eligible).toBe(true);
  expect(s.coverage).toBe(1);
  expect(s.parts.find((p) => p.id === "topic")?.evidence).toEqual([
    "p0",
    "p1",
    "p2",
  ]);
  expect(s.parts.find((p) => p.id === "audience")?.reason).toContain(
    "反応ユーザーの属性を示すものではありません",
  );
});
it("caps assessment at the newest 20 posts and excludes future posts and ice/skateboard confusion", () => {
  const future = {
    ...candidate.posts[0],
    id: "future",
    at: "2027-01-01T00:00:00Z",
  };
  const s = scoreCandidate(
    {
      ...candidate,
      posts: [...candidate.posts, ...candidate.posts, ...[future]],
    },
    plan,
    reference,
  );
  expect(s.parts[0].reason).toContain("直近20投稿");
  const board = scoreCandidate(
    {
      ...candidate,
      posts: candidate.posts.map((p) => ({
        ...p,
        caption: "スケートパークでスケートボード",
      })),
    },
    plan,
    reference,
  );
  expect(board.eligible).toBe(false);
  expect(board.parts[0].value).toBe(0);
});
it("never normalizes unknown data to a perfect score or recommends private/minor accounts", () => {
  for (const c of [
    { ...candidate, private: true },
    { ...candidate, minor: true },
  ]) {
    expect(scoreCandidate(c, plan, reference).eligible).toBe(false);
    expect(scoreCandidate(c, plan, reference).score).toBeNull();
  }
  const s = scoreCandidate(
    { ...candidate, posts: [], bio: "", followers: null },
    plan,
    reference,
  );
  expect(s.score).toBeNull();
  expect(s.label).toBe("判定材料不足");
});
it("ranks at most ten unique qualified people and preserves a better duplicate", () => {
  const assessment = scoreCandidate(candidate, plan, reference);
  const items = Array.from({ length: 15 }, (_, i) => ({
    candidate: { ...candidate, username: `c${i}`, id: `c${i}` },
    assessment: { ...assessment, score: 70 + i },
  }));
  items.unshift({
    candidate: items[14].candidate,
    assessment: { ...assessment, score: 60 },
  });
  const ranked = rankCandidates(items);
  expect(ranked).toHaveLength(10);
  expect(ranked[0].assessment.score).toBe(84);
  expect(new Set(ranked.map((x) => x.candidate.username)).size).toBe(10);
  expect(
    rankCandidates([
      { candidate, assessment: { ...assessment, eligible: false } },
    ]),
  ).toHaveLength(0);
});
const analysis: Analysis = {
  userId: "u",
  gender: "不明",
  age: "20代",
  confidence: 0.9,
  genderConfidence: 0,
  ageConfidence: 0.9,
  reason: "",
  interests: Object.fromEntries(
    ["カップル", "スケート関心"].map((t) => [
      t,
      { value: true, confidence: 0.9, reason: "", evidence: [] },
    ]),
  ),
  skate: {
    result: "went",
    type: "体験",
    score: 5,
    confidence: 0.9,
    reason: "",
    evidence: [],
  },
};
it("evaluates audience goals with a public-account denominator and saturates at configured targets", () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({
    ...analysis,
    userId: String(i),
  }));
  const r = scoreReach(rows, plan);
  expect(r.score).toBe(100);
  expect(r.denominator).toBe(100);
  expect(r.parts.every((p) => p.points === p.weight)).toBe(true);
  expect(scoreReach(rows.slice(0, 10), plan).score).toBeNull();
});
it("counts a person once across target categories and exposes unknowns rather than a low-quality verdict", () => {
  const multi = {
    ...plan,
    goal: {
      ...plan.goal,
      targetTags: ["カップル", "子持ち"] as Goal["targetTags"],
    },
  };
  const rows = Array.from({ length: 100 }, (_, i) => ({
    ...analysis,
    userId: String(i),
    interests: {
      ...analysis.interests,
      子持ち: { value: true, confidence: 0.9, reason: "", evidence: [] },
    },
  }));
  expect(scoreReach(rows, multi).parts[0].matches).toBe(100);
  expect(
    scoreReach(
      rows.map((a) => ({ ...a, age: "不明", interests: {} })),
      plan,
    ).score,
  ).toBeNull();
});
it("enforces the 3,000 yen cap including concurrent reservations and conservative conversion inputs", () => {
  expect(canReserve(1000, 1000, 1000)).toBe(true);
  expect(canReserve(1000, 1000, 1001)).toBe(false);
  expect(canReserve(0, 0, 3001)).toBe(false);
  expect(canReserve(0, 0, 100, 10000)).toBe(false);
  expect(canReserve(0, 0, -1)).toBe(false);
  expect(canReserve(NaN, 0, 1)).toBe(false);
  expect(projectedYen(10, 150)).toBe(1898);
  expect(() => projectedYen(1, 0)).toThrow();
});
