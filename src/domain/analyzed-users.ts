import type { Analysis, Profile, Category } from "./types";
export type AnalyzedUser = {
  key: string;
  name: string;
  displayName: string;
  profileUrl: string | null;
  masked: boolean;
  demo: boolean;
  reactions: ("like" | "comment")[];
  gender: string;
  age: string;
  reason: string;
  genderConfidence: number;
  ageConfidence: number;
  tags: {
    name: string;
    reason: string;
    confidence: number;
    criterion: string;
  }[];
  skate: { label: string; score: number; confidence: number; reason: string };
};
export function analyzedUser(
  profile: Profile,
  analysis: Analysis,
  reactions: ("like" | "comment")[],
  demo: boolean,
  key: string,
  categories: Category[] = [],
): AnalyzedUser {
  const masked = analysis.age === "10代";
  const label =
    analysis.skate.result === "went"
      ? "行った（確度高）"
      : analysis.skate.result === "maybe"
        ? "可能性あり"
        : analysis.skate.type === "観戦"
          ? "観戦"
          : "該当なし";
  return {
    key,
    name: masked ? "非表示（10代）" : profile.username,
    displayName: masked ? "個人情報は非表示" : profile.displayName,
    profileUrl: masked
      ? null
      : demo
        ? `/demo/profile/${encodeURIComponent(profile.id)}`
        : /^[a-zA-Z0-9_.]{1,30}$/.test(profile.username)
          ? `https://www.instagram.com/${profile.username}/`
          : null,
    masked,
    demo,
    reactions: [...new Set(reactions)],
    gender: analysis.gender,
    age: analysis.age,
    reason: masked
      ? "判定根拠の文章は個人情報保護のため非表示"
      : analysis.reason,
    genderConfidence: analysis.genderConfidence,
    ageConfidence: analysis.ageConfidence,
    tags: Object.entries(analysis.interests)
      .filter(([, tag]) => tag.value === true)
      .map(([name, tag]) => ({
        name,
        criterion: categories.find((c) => c.name === name)?.guidance ?? "",
        reason: masked ? "個人情報保護のため根拠は非表示" : tag.reason,
        confidence: tag.confidence,
      })),
    skate: {
      label,
      score: analysis.skate.score,
      confidence: analysis.skate.confidence,
      reason: masked ? "個人情報保護のため根拠は非表示" : analysis.skate.reason,
    },
  };
}
