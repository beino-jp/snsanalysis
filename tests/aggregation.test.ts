import { describe, it, expect } from "vitest";
import { aggregateAll, percent } from "../src/domain/aggregation";
import { Analysis, Engagement, Profile } from "../src/domain/types";
const profiles: Profile[] = ["a", "b", "c"].map((id) => ({
  id,
  username: id,
  displayName: id,
  bio: "",
  private: id === "c",
}));
const analyses: Analysis[] = [
  {
    userId: "a",
    gender: "女性",
    age: "20代",
    confidence: 0.9,
    genderConfidence: 0.9,
    ageConfidence: 0.9,
    reason: "",
    interests: {
      カップル: { value: true, confidence: 0.9, reason: "", evidence: [] },
    },
    skate: {
      result: "went",
      type: "体験",
      score: 5,
      confidence: 0.9,
      evidence: [],
      reason: "",
    },
  },
  {
    userId: "b",
    gender: "不明",
    age: "不明",
    confidence: 0.6,
    genderConfidence: 0,
    ageConfidence: 0,
    reason: "",
    interests: {},
    skate: {
      result: "no",
      type: "観戦",
      score: 2,
      confidence: 0.9,
      evidence: [],
      reason: "",
    },
  },
];
const rows: Engagement[] = [
  { id: "l1", userId: "a", type: "like" },
  { id: "l2", userId: "c", type: "like" },
  { id: "c1", userId: "a", type: "comment" },
  { id: "c2", userId: "a", type: "comment" },
  { id: "c3", userId: "b", type: "comment" },
  { id: "c4", userId: "owner", type: "comment" },
];
describe("F-07 aggregation", () => {
  it("deduplicates people per channel and union; retains comment records", () => {
    const a = aggregateAll(rows, profiles, analyses, "owner", 10, 10);
    expect(a.like.total).toBe(2);
    expect(a.comment.total).toBe(2);
    expect(a.comment.records).toBe(3);
    expect(a.unique.total).toBe(3);
    expect(a.comment.acquisition).toBe(0.3);
    expect(a.unique.acquisition).toBeNull();
  });
  it("excludes private accounts from attribute denominator and includes unknowns", () => {
    const a = aggregateAll(rows, profiles, analyses, "owner", 10, 10);
    expect(a.like.private).toBe(1);
    expect(a.like.analyzed).toBe(1);
    expect(a.unique.analyzed).toBe(2);
    expect(a.unique.gender).toEqual({ 女性: 1, 不明: 1 });
    expect(a.unique.cross).toEqual({ "女性・20代": 1, "不明・不明": 1 });
    expect(Object.values(a.unique.skate).reduce((s, v) => s + v, 0)).toBe(2);
    expect(a.unique.highInterest).toBe(1);
  });
  it("keeps fetch failures outside analyzed denominator", () => {
    const a = aggregateAll(
      [...rows, { id: "missing", userId: "missing", type: "like" }],
      profiles,
      analyses,
      "owner",
      10,
      10,
    );
    expect(a.like.failed).toBe(1);
    expect(a.like.analyzed).toBe(1);
    expect(a.like.total).toBe(3);
  });
  it("switches denominator without NaN and handles empty results", () => {
    expect(percent(1, 2)).toBe(50);
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(1, 0)).toBe(0);
    const a = aggregateAll([], [], [], "owner", 0, 0);
    expect(a.unique.analyzed).toBe(0);
    expect(a.like.acquisition).toBeNull();
  });
});

it("aggregates 10,000 people with repeated channel membership consistently", () => {
  const people = Array.from({ length: 10000 }, (_, i) => ({
    ...profiles[0],
    id: String(i),
  }));
  const attrs = people.map((p) => ({ ...analyses[0], userId: p.id }));
  const e = people.flatMap((p) => [
    { id: "l" + p.id, userId: p.id, type: "like" as const },
    { id: "c" + p.id, userId: p.id, type: "comment" as const },
  ]);
  const result = aggregateAll(e, people, attrs, "owner", 10000, 10000);
  expect(result.unique.total).toBe(10000);
  expect(result.unique.analyzed).toBe(10000);
  expect(result.like.highInterest).toBe(10000);
  expect(result.unique.cross["女性・20代"]).toBe(10000);
});
