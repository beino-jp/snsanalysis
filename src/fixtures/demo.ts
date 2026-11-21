import { Engagement, Post, Profile, Target } from "../domain/types";
export const DEMO_URL = "https://www.instagram.com/p/DEMO_GINZA_2026/";
export const target: Target = {
  id: "demo-ginza",
  url: DEMO_URL,
  ownerId: "owner",
  owner: "haruka_weekend",
  postedAt: "2026-11-15T03:00:00Z",
  likes: 1840,
  comments: 128,
  caption: "冬の銀座で、いつもと違う週末を。GINZA SIXのアイスリンクへ。 #PR",
};
export function fixtures(reference: string) {
  const profiles: Profile[] = Array.from({ length: 48 }, (_, i) => ({
    id: `u${i}`,
    username: `demo_${String(i + 1).padStart(3, "0")}`,
    displayName: ["葵", "悠", "美咲", "蓮", "陽菜", "凛"][i % 6] + "（架空）",
    bio:
      i % 9 === 0
        ? "非公開"
        : i % 4 === 0
          ? "30歳。夫と子どもと暮らす日々。ママ。"
          : i % 4 === 1
            ? "26歳・女性。彼と週末おでかけ。犬が好き。"
            : i % 4 === 2
              ? "34歳・男性。休日はスポーツと散歩。"
              : "年齢・性別は非公表。写真と日常。",
    private: i % 9 === 0,
    followers: 120 + i * 23,
  }));
  profiles[8].bio = "17歳・女性。日常の記録。";
  const at = (days: number) =>
    new Date(Date.parse(reference) - days * 86400000).toISOString();
  const posts: Record<string, Post[]> = {};
  for (let i = 0; i < profiles.length; i++) {
    const kind = i % 8;
    const p: Post = {
      id: `post-${i}`,
      url: `https://www.instagram.com/p/DEMO_EVIDENCE_${i}/`,
      at: at(kind === 5 ? 366 : 30 + i),
      caption:
        kind === 0
          ? "アイススケートに行ってきた！初スケートで滑った。"
          : kind === 1
            ? "スケートデートへ行ってきた"
            : kind === 2
              ? "アイススケートの試合を観戦。アイスショー最高"
              : kind === 3
                ? "スケートパークでスケボー！滑った"
                : kind === 4
                  ? "ローラースケートに行ってきた"
                  : kind === 5
                    ? "アイススケートへ行ってきた"
                    : kind === 6
                      ? "いつもの休日、犬と公園へ"
                      : "アイススケートが気になる",
      hashtags:
        kind === 0 || kind === 5
          ? ["アイススケート"]
          : kind === 1
            ? ["スケートデート"]
            : [],
      location: kind === 0 || kind === 5 ? "GINZA SIX アイスリンク" : undefined,
      mockVision:
        kind === 0
          ? "ice"
          : kind === 2
            ? "spectating"
            : kind === 3
              ? "skateboard"
              : kind === 4
                ? "roller"
                : "none",
    };
    posts[profiles[i].id] = [p];
  }
  const engagements: Engagement[] = [
    ...profiles
      .slice(0, 42)
      .map((p) => ({
        id: `like-${p.id}`,
        userId: p.id,
        type: "like" as const,
      })),
    ...profiles
      .slice(24)
      .flatMap((p, i) => [
        {
          id: `comment-${p.id}`,
          userId: p.id,
          type: "comment" as const,
          text: "素敵な週末ですね！（デモ）",
          at: at(2),
        },
        ...(i % 6 === 0
          ? [
              {
                id: `reply-${p.id}`,
                userId: p.id,
                type: "comment" as const,
                text: "また行きたいです（デモ）",
                at: at(1),
              },
            ]
          : []),
      ]),
    {
      id: "owner-comment",
      userId: "owner",
      type: "comment",
      text: "ありがとうございます！",
      at: at(1),
    },
  ];
  return { profiles, posts, engagements };
}
