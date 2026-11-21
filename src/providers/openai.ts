import OpenAI from "openai";
import { z } from "zod";
import { LLMProvider } from "./interfaces";
import { Post, Profile, Settings } from "../domain/types";
import { SYSTEM_PROMPT } from "../prompts/attributes";
const interest = z.object({
  value: z.boolean().nullable(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  evidence: z.array(z.string()),
});
const schema = z.object({
  attributes: z.object({
    gender: z.enum(["女性", "男性", "不明"]),
    age: z.enum(["10代", "20代", "30代", "40代", "50代", "60代以上", "不明"]),
    confidence: z.number().min(0).max(1),
    genderConfidence: z.number().min(0).max(1),
    ageConfidence: z.number().min(0).max(1),
    reason: z.string(),
    interests: z.record(interest),
  }),
  skate: z.object({
    result: z.enum(["went", "maybe", "no"]),
    confidence: z.number().min(0).max(1),
    reason: z.string(),
    evidence: z.array(z.string()),
  }),
});
export class OpenAILLMProvider implements LLMProvider {
  name = "openai";
  model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // Never download or persist image bytes. Only Instagram CDN URLs accepted.
  async vision(post: Post) {
    const urls = (post.imageUrls ?? []).filter((raw) => {
      try {
        const u = new URL(raw);
        return (
          u.protocol === "https:" &&
          (u.hostname.endsWith(".cdninstagram.com") ||
            u.hostname.endsWith(".fbcdn.net"))
        );
      } catch {
        return false;
      }
    });
    if (!urls.length) return "none" as const;
    const r = await this.client.chat.completions.create({
      model: this.model,
      store: false,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Classify images as ice, spectating, skateboard, roller or none. Return JSON {"kind":"..."}. Ice requires rink/skates/skating visible; screens or audience are spectating.',
        },
        {
          role: "user",
          content: urls.map((url) => ({
            type: "image_url" as const,
            image_url: { url, detail: "low" as const },
          })),
        },
      ],
    });
    return z
      .object({
        kind: z.enum(["ice", "spectating", "skateboard", "roller", "none"]),
      })
      .parse(JSON.parse(r.choices[0].message.content ?? "{}")).kind;
  }
  async analyze(
    profile: Profile,
    posts: Post[],
    candidates: Post[],
    s: Settings,
  ) {
    const r = await this.client.chat.completions.create({
      model: this.model,
      store: false,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            SYSTEM_PROMPT +
            " Output shape: " +
            JSON.stringify({
              attributes: {
                gender: "不明",
                age: "不明",
                confidence: 0,
                genderConfidence: 0,
                ageConfidence: 0,
                reason: "",
                interests: Object.fromEntries(
                  s.categories.map((c) => [
                    c.name,
                    { value: null, confidence: 0, reason: "", evidence: [] },
                  ]),
                ),
              },
              skate: { result: "no", confidence: 0, evidence: [], reason: "" },
            }),
        },
        {
          role: "user",
          content: JSON.stringify({
            profile,
            posts: posts.map(({ imageUrls, ...p }) => p),
            candidate_ids: candidates.map((p) => p.id),
            categories: s.categories,
          }),
        },
      ],
    });
    const parsed = schema.parse(
      JSON.parse(r.choices[0].message.content ?? "{}"),
    );
    const inputTokens = r.usage?.prompt_tokens ?? 0,
      outputTokens = r.usage?.completion_tokens ?? 0;
    const a = process.env.OPENAI_INPUT_USD_PER_MILLION,
      b = process.env.OPENAI_OUTPUT_USD_PER_MILLION;
    return {
      ...parsed,
      inputTokens,
      outputTokens,
      cost:
        a && b
          ? (inputTokens * Number(a) + outputTokens * Number(b)) / 1e6
          : null,
    };
  }
}
