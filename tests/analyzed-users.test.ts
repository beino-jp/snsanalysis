import { it, expect } from "vitest";
import { analyzedUser } from "../src/domain/analyzed-users";
import type { Profile, Analysis } from "../src/domain/types";
const profile: Profile = {
  id: "abc",
  username: "sample.person",
  displayName: "サンプル",
  bio: "",
  private: false,
};
const analysis: Analysis = {
  userId: "abc",
  gender: "女性",
  age: "20代",
  confidence: 0.9,
  genderConfidence: 0.8,
  ageConfidence: 0.9,
  reason: "本人の自己紹介",
  interests: {
    カップル: {
      value: true,
      confidence: 0.9,
      reason: "パートナーを明記",
      evidence: ["p"],
    },
    犬好き: { value: false, confidence: 0.9, reason: "根拠なし", evidence: [] },
  },
  skate: {
    result: "went",
    type: "体験",
    score: 6,
    confidence: 0.9,
    evidence: ["p"],
    reason: "施設と画像で確認",
  },
};
it("exposes selected tags, reasons, score and Instagram profile link", () => {
  const u = analyzedUser(
    profile,
    analysis,
    ["like", "comment", "like"],
    false,
    "0",
    [{ name: "カップル", guidance: "交際の明示や繰り返すデート投稿" }],
  );
  expect(u.profileUrl).toBe("https://www.instagram.com/sample.person/");
  expect(u.reactions).toEqual(["like", "comment"]);
  expect(u.tags).toEqual([
    {
      name: "カップル",
      confidence: 0.9,
      reason: "パートナーを明記",
      criterion: "交際の明示や繰り返すデート投稿",
    },
  ]);
  expect(u.skate).toMatchObject({ label: "行った（確度高）", score: 6 });
});
it("masks identifying text and links for teens before API serialization", () => {
  const u = analyzedUser(
    profile,
    {
      ...analysis,
      age: "10代",
      reason: "sample.person",
      skate: { ...analysis.skate, reason: "サンプル本人" },
      interests: {
        カップル: {
          value: true,
          confidence: 0.9,
          reason: "sample.person",
          evidence: [],
        },
      },
    },
    ["like"],
    false,
    "0",
  );
  const json = JSON.stringify(u);
  expect(u.profileUrl).toBeNull();
  expect(u.name).toBe("非表示（10代）");
  expect(json).not.toContain("sample.person");
  expect(json).not.toContain("サンプル");
  expect(json).not.toContain("abc");
});
it("uses a local sample profile for synthetic users, never an unrelated Instagram account", () => {
  expect(analyzedUser(profile, analysis, ["like"], true, "0").profileUrl).toBe(
    "/demo/profile/abc",
  );
});
it("rejects malformed handles and distinguishes watching", () => {
  expect(
    analyzedUser(
      { ...profile, username: "evil/path?x=1" },
      analysis,
      [],
      false,
      "0",
    ).profileUrl,
  ).toBeNull();
  expect(
    analyzedUser(
      profile,
      { ...analysis, skate: { ...analysis.skate, result: "no", type: "観戦" } },
      [],
      false,
      "0",
    ).skate.label,
  ).toBe("観戦");
});
