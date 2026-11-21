export type Gender = "女性" | "男性" | "不明";
export type Age =
  "10代" | "20代" | "30代" | "40代" | "50代" | "60代以上" | "不明";
export type Engagement = {
  id: string;
  userId: string;
  type: "like" | "comment";
  text?: string;
  at?: string;
};
export type Profile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  private: boolean;
  followers?: number;
  following?: number;
  postCount?: number;
  business?: boolean;
  category?: string;
  externalUrl?: string;
};
export type Post = {
  id: string;
  url: string;
  at: string;
  caption: string;
  hashtags: string[];
  location?: string;
  mentions?: string[];
  imageUrls?: string[];
  visionObservation?: "ice" | "spectating" | "skateboard" | "roller" | "none";
  mockVision?: "ice" | "spectating" | "skateboard" | "roller" | "none";
};
export type Target = {
  id: string;
  url: string;
  ownerId: string;
  owner: string;
  postedAt: string;
  likes: number;
  comments: number;
  caption: string;
};
export type Skate = {
  result: "went" | "maybe" | "no";
  type: "体験" | "観戦" | "スケボー" | "その他";
  score: number;
  confidence: number;
  evidence: string[];
  reason: string;
};
export type Analysis = {
  userId: string;
  gender: Gender;
  age: Age;
  confidence: number;
  genderConfidence: number;
  ageConfidence: number;
  reason: string;
  interests: Record<
    string,
    {
      value: boolean | null;
      confidence: number;
      reason: string;
      evidence: string[];
    }
  >;
  skate: Skate;
};
export type Category = { name: string; guidance: string };
export type Settings = {
  confidence: number;
  cacheDays: number;
  retentionDays: number;
  reference: "execution" | "post";
  captionlessVision: boolean;
  includeRoller: boolean;
  weights: {
    location: number;
    hashtag: number;
    caption: number;
    experience: number;
    vision: number;
  };
  high: number;
  medium: number;
  rinks: string[];
  keywords: string[];
  hashtags: string[];
  experience: string[];
  exclusions: string[];
  spectators: string[];
  categories: Category[];
};
export const defaults: Settings = {
  confidence: 0.6,
  cacheDays: 30,
  retentionDays: 90,
  reference: "execution",
  captionlessVision: false,
  includeRoller: false,
  weights: { location: 3, hashtag: 2, caption: 2, experience: 1, vision: 3 },
  high: 5,
  medium: 2,
  rinks: [
    "GINZA SIX アイスリンク",
    "銀座シックス アイスリンク",
    "明治神宮外苑アイススケート場",
    "三井不動産アイスリンク",
    "ダイドードリンコアイスアリーナ",
  ],
  keywords: [
    "アイススケート",
    "スケート",
    "スケートリンク",
    "リンクで滑った",
    "ice skating",
  ],
  hashtags: [
    "アイススケート",
    "スケートリンク",
    "スケートデート",
    "iceskating",
    "iceskate",
    "スケート",
  ],
  experience: ["行ってきた", "滑った", "初スケート", "転んだ", "デートで"],
  exclusions: ["スケボー", "スケートボード", "skateboard", "スケートパーク"],
  spectators: ["観戦", "試合", "アイスショー", "テレビ観戦"],
  categories: [
    {
      name: "カップル",
      guidance: "本人が明示した交際・パートナーや繰り返されるデート投稿",
    },
    { name: "子持ち", guidance: "本人の育児・子どもの記述" },
    {
      name: "スケート関心",
      guidance: "体験、可能性あり、観戦、またはbioにスケートの記述",
    },
    { name: "犬好き", guidance: "犬についてのbioや繰り返される投稿" },
  ],
};
