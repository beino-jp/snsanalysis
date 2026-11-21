import type { DataProvider, LLMProvider } from "../interfaces";
import type { Candidate, Goal, Planning } from "../../domain/campaign/types";
export interface DiscoveryDataProvider extends Pick<DataProvider, "name"> {
  search(queries: string[], limit: number): Promise<string[]>;
  candidate(username: string, postLimit: number): Promise<Candidate>;
}
export interface CampaignLLMProvider extends Pick<
  LLMProvider,
  "name" | "model"
> {
  plan(goal: Goal): Promise<Planning>;
}
