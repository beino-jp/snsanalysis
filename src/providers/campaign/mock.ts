import type { Candidate, Goal } from "../../domain/campaign/types";
import type { DiscoveryDataProvider, CampaignLLMProvider } from "./interfaces";
import { planGoal } from "../../domain/campaign/plan";
const topics = [
  "スケート",
  "グルメ",
  "旅行",
  "犬",
  "スケート",
  "美容",
  "おでかけ",
  "子育て",
];
export class MockDiscoveryProvider implements DiscoveryDataProvider {
  name = "mock";
  constructor(private reference: string) {}
  async search(_: string[], limit: number) {
    return Array.from(
      { length: Math.min(100, limit) },
      (_, i) => `sample_creator_${String(i + 1).padStart(3, "0")}`,
    );
  }
  async candidate(username: string, limit: number): Promise<Candidate> {
    const i = Number(username.split("_").at(-1)) - 1;
    if (!Number.isInteger(i) || i < 0 || i >= 100)
      throw Error("架空候補が見つかりません");
    const topic = topics[i % topics.length],
      region = i % 5 === 0 ? "大阪" : "東京",
      audience =
        i % 3 === 0
          ? "子育て 親子"
          : i % 3 === 1
            ? "カップル デート"
            : "犬好き ペット";
    const followers = 3000 + i * 731;
    return {
      id: `creator-${i + 1}`,
      username,
      name:
        ["休日の手帖", "親子のおでかけ", "ふたりの週末", "街歩き日和"][i % 4] +
        String(i + 1),
      bio: `${region}の${topic}を発信。${audience}の体験を紹介。`,
      followers,
      private: i % 23 === 0,
      minor: i % 29 === 0,
      profileUrl: `/demo/influencer/${i + 1}`,
      demo: true,
      posts: Array.from(
        { length: i % 23 === 0 || i % 29 === 0 ? 0 : Math.min(20, limit) },
        (_, j) => ({
          id: `creator-${i + 1}-post-${j}`,
          url: "",
          at: new Date(
            Date.parse(this.reference) - (j * 3 + (i % 4)) * 86400000,
          ).toISOString(),
          caption:
            j < 12
              ? `${region}で${audience}と楽しむ${topic}。休日に訪れたいスポットの紹介。`
              : "日常の記録",
          likes:
            i % 11 === 0
              ? null
              : Math.round(followers * (0.012 + (i % 7) * 0.005)),
          comments: i % 11 === 0 ? null : 4 + (i % 15),
        }),
      ),
    };
  }
}
export class RuleCampaignLLMProvider implements CampaignLLMProvider {
  name = "rules";
  model = "goal-rules-v1";
  async plan(goal: Goal) {
    return planGoal(goal);
  }
}
