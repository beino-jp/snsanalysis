import {
  Analysis,
  Engagement,
  Post,
  Profile,
  Settings,
  Target,
} from "../domain/types";
export type Page<T> = {
  items: T[];
  cursor: string | null;
  cost: number | null;
};
export interface DataProvider {
  name: string;
  target(url: string): Promise<Target>;
  engagements(
    target: Target,
    type: "like" | "comment",
    cursor: string | null,
  ): Promise<Page<Engagement>>;
  profile(userId: string): Promise<Profile>;
  posts(
    user: Profile,
    reference: string,
    cursor: string | null,
  ): Promise<Page<Post>>;
}
export interface LLMProvider {
  name: string;
  model: string;
  vision(
    post: Post,
  ): Promise<"ice" | "spectating" | "skateboard" | "roller" | "none">;
  analyze(
    profile: Profile,
    posts: Post[],
    candidates: Post[],
    settings: Settings,
  ): Promise<{
    attributes: Omit<Analysis, "userId" | "skate">;
    skate: {
      result: "went" | "maybe" | "no";
      confidence: number;
      reason: string;
      evidence: string[];
    };
    inputTokens: number;
    outputTokens: number;
    cost: number | null;
  }>;
}
