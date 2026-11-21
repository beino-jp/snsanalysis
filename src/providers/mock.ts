import { DataProvider, LLMProvider } from "./interfaces";
import { fixtures, target } from "../fixtures/demo";
import { Analysis, Post, Profile, Settings } from "../domain/types";
export class MockDataProvider implements DataProvider {
  name = "mock";
  constructor(private reference: string) {}
  async target(url: string) {
    return { ...target, url };
  }
  async engagements(
    _: unknown,
    type: "like" | "comment",
    cursor: string | null,
  ) {
    const list = fixtures(this.reference).engagements.filter(
      (e) => e.type === type,
    );
    const offset = Number(cursor ?? 0);
    return {
      items: list.slice(offset, offset + 12),
      cursor: offset + 12 < list.length ? String(offset + 12) : null,
      cost: 0,
    };
  }
  async profile(id: string) {
    const p = fixtures(this.reference).profiles.find((p) => p.id === id);
    if (!p) throw Error("プロフィールが見つかりません");
    return p;
  }
  async posts(p: Profile) {
    if (p.private) throw Error("鍵アカの投稿取得は禁止");
    return {
      items: fixtures(this.reference).posts[p.id] ?? [],
      cursor: null,
      cost: 0,
    };
  }
}
export class MockLLMProvider implements LLMProvider {
  name = "mock";
  model = "deterministic-fixture-v1";
  async vision(p: Post) {
    return p.mockVision ?? "none";
  }
  async analyze(p: Profile, posts: Post[], candidates: Post[], s: Settings) {
    const gender: Analysis["gender"] = p.bio.includes("女性")
      ? "女性"
      : p.bio.includes("男性")
        ? "男性"
        : "不明";
    const age: Analysis["age"] = p.bio.includes("17歳")
      ? "10代"
      : p.bio.includes("26歳")
        ? "20代"
        : /30歳|34歳/.test(p.bio)
          ? "30代"
          : "不明";
    const interests = Object.fromEntries(
      s.categories.map((c) => [
        c.name,
        {
          value:
            c.name === "カップル"
              ? /夫|彼/.test(p.bio)
              : c.name === "子持ち"
                ? p.bio.includes("ママ")
                : c.name === "犬好き"
                  ? p.bio.includes("犬")
                  : c.name === "スケート関心"
                    ? p.bio.includes("スケート")
                    : null,
          confidence: 0.9,
          reason: "架空の自己紹介に基づく固定判定",
          evidence: [],
        },
      ]),
    );
    const ice = candidates.find((x) => x.mockVision === "ice");
    const maybe = candidates.find((x) =>
      /スケートデート|気になる/.test(x.caption),
    );
    return {
      attributes: {
        gender,
        age,
        confidence: 0.9,
        genderConfidence: gender === "不明" ? 0 : 0.9,
        ageConfidence: age === "不明" ? 0 : 0.95,
        reason: "明示された自己紹介から判定（モック）",
        interests,
      },
      skate: {
        result: ice
          ? ("went" as const)
          : maybe
            ? ("maybe" as const)
            : ("no" as const),
        confidence: 0.92,
        reason: ice
          ? "位置情報・ハッシュタグと画像確認のデモ結果"
          : maybe
            ? "文章に関心の記述。体験は未確認"
            : "体験の根拠なし",
        evidence: [...(ice ? [ice.id] : maybe ? [maybe.id] : [])],
      },
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
    };
  }
}
