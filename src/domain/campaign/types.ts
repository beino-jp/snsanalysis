import { z } from "zod";
export const SEARCH_BUDGET_JPY = 3000;
export const PROMPT_VERSION = "campaign-2026-11-21.1";
export const GoalSchema = z.object({
  purpose: z.string().trim().min(5).max(1500),
  objective: z.enum(["awareness", "visits", "sales"]).optional(),
  audience: z.string().trim().max(200).default(""),
  region: z.string().trim().max(80).default(""),
  topic: z.string().trim().max(100).default(""),
  targetTags: z
    .array(z.enum(["カップル", "子持ち", "犬好き"]))
    .max(3)
    .default([]),
  ages: z
    .array(z.enum(["20代", "30代", "40代", "50代", "60代以上"]))
    .max(5)
    .default([]),
  sourceJobId: z.string().uuid().nullable().default(null),
});
export type Goal = z.infer<typeof GoalSchema>;
export type Criterion = {
  id: "audience" | "interest" | "age";
  label: string;
  weight: number;
  target: number;
};
export const PlanSchema = z
  .object({
    goal: GoalSchema,
    summary: z.string().max(300),
    queries: z.array(z.string().min(1).max(100)).min(1).max(5),
    criteria: z
      .array(
        z.object({
          id: z.enum(["audience", "interest", "age"]),
          label: z.string().max(80),
          weight: z.number().int().min(0).max(100),
          target: z.number().min(0.01).max(1),
        }),
      )
      .max(3),
    recommendThreshold: z.number().int().min(0).max(100).default(60),
    version: z.literal(PROMPT_VERSION),
  })
  .superRefine((p, ctx) => {
    if (new Set(p.criteria.map((c) => c.id)).size !== p.criteria.length)
      ctx.addIssue({ code: "custom", message: "評価項目が重複しています" });
    if (
      p.criteria.length &&
      p.criteria.reduce((n, c) => n + c.weight, 0) !== 100
    )
      ctx.addIssue({
        code: "custom",
        message: "配点の合計を100にしてください",
      });
  });
export type Plan = z.infer<typeof PlanSchema>;
export type Question = {
  field: "objective" | "audience" | "region" | "topic";
  text: string;
};
export type Planning = {
  questions: Question[];
  plan: Plan | null;
  provider: string;
};
export type CandidatePost = {
  id: string;
  url: string;
  at: string;
  caption: string;
  likes: number | null;
  comments: number | null;
};
export type Candidate = {
  id: string;
  username: string;
  name: string;
  bio: string;
  followers: number | null;
  private: boolean;
  minor: boolean;
  posts: CandidatePost[];
  profileUrl: string;
  demo: boolean;
};
export type ScorePart = {
  id: string;
  label: string;
  weight: number;
  value: number | null;
  points: number | null;
  reason: string;
  evidence: string[];
};
export type CandidateScore = {
  score: number | null;
  coverage: number;
  maxPossible: number;
  label: string;
  parts: ScorePart[];
  eligible: boolean;
  excluded: string | null;
};
export type Recommendation = {
  candidate: Candidate;
  assessment: CandidateScore;
};
export const rejectSensitive = (text: string) => {
  if (/宗教|信仰|支持政党|政治思想|性的指向|病歴|精神疾患|人種|民族/.test(text))
    throw Error("健康・宗教・政治など配慮が必要な属性は評価条件にできません");
};
