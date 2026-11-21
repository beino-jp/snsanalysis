import { describe, it, expect } from "vitest";
import { defaults, Post } from "../src/domain/types";
import { scorePost, decideSkate } from "../src/domain/skate";
const reference = "2026-11-21T00:00:00Z";
const post = (p: Partial<Post> = {}): Post => ({
  id: "p",
  url: "https://www.instagram.com/p/p/",
  at: "2026-11-01T00:00:00Z",
  caption: "",
  hashtags: [],
  ...p,
});
const ai = {
  result: "went" as const,
  confidence: 0.9,
  reason: "確認",
  evidence: ["p"],
};
describe("F-06-4 scoring", () => {
  it("adds each signal once, and requires C before experience language", () => {
    expect(
      scorePost(
        post({
          location: defaults.rinks[0],
          hashtags: ["#アイススケート", "iceskating"],
          caption: "アイススケートに行ってきた、滑った",
        }),
        reference,
        defaults,
      ).score,
    ).toBe(8);
    expect(
      scorePost(post({ caption: "行ってきた、転んだ" }), reference, defaults)
        .score,
    ).toBe(0);
  });
  it.each([
    "スケボー",
    "スケートボード",
    "SKATEBOARD",
    "スケートパーク",
    "ローラースケート",
  ])("excludes %s even with rink and ice tag", (term) => {
    const sig = scorePost(
      post({
        caption: term,
        location: defaults.rinks[0],
        hashtags: ["アイススケート"],
      }),
      reference,
      defaults,
    );
    expect(sig.excluded).toBe(true);
    expect(decideSkate([sig], { p: "ice" }, ai, defaults).result).toBe("no");
  });
  it("includes exactly 365 days and excludes older and future posts", () => {
    const cutoff = Date.parse(reference) - 365 * 86400000;
    expect(
      scorePost(
        post({ at: new Date(cutoff).toISOString(), caption: "スケート" }),
        reference,
        defaults,
      ).candidate,
    ).toBe(true);
    for (const at of [cutoff - 1, Date.parse(reference) + 1])
      expect(
        scorePost(post({ at: new Date(at).toISOString() }), reference, defaults)
          .excluded,
      ).toBe(true);
  });
  it("requires AI went AND score >=5 for high confidence", () => {
    const sig = scorePost(
      post({ hashtags: ["アイススケート"] }),
      reference,
      defaults,
    );
    expect(decideSkate([sig], { p: "ice" }, ai, defaults).result).toBe("went");
    expect(decideSkate([sig], { p: "none" }, ai, defaults).result).toBe(
      "maybe",
    );
    expect(
      decideSkate([sig], { p: "ice" }, { ...ai, result: "maybe" }, defaults)
        .result,
    ).toBe("maybe");
  });
  it("prioritizes no, low confidence, and unsupported evidence", () => {
    const sig = scorePost(
      post({ location: defaults.rinks[0] }),
      reference,
      defaults,
    );
    for (const a of [
      { ...ai, result: "no" as const },
      { ...ai, confidence: 0.59 },
      { ...ai, evidence: ["invented"] },
    ])
      expect(decideSkate([sig], { p: "ice" }, a, defaults).result).toBe("no");
  });
  it("records watching separately even if AI incorrectly says went", () => {
    const sig = scorePost(
      post({
        caption: "アイススケートの試合を観戦",
        hashtags: ["アイススケート"],
      }),
      reference,
      defaults,
    );
    expect(decideSkate([sig], { p: "ice" }, ai, defaults)).toMatchObject({
      result: "no",
      type: "観戦",
    });
  });
  it("vision can veto text; captionless scanning is opt-in", () => {
    const p = post({ hashtags: ["アイススケート"] });
    const sig = scorePost(p, reference, defaults);
    for (const kind of ["skateboard", "roller"] as const)
      expect(decideSkate([sig], { p: kind }, ai, defaults).result).toBe("no");
    expect(scorePost(post(), reference, defaults).candidate).toBe(false);
    expect(
      scorePost(post(), reference, { ...defaults, captionlessVision: true })
        .candidate,
    ).toBe(true);
  });
  it("supports configurable weights and roller exclusion", () => {
    expect(
      scorePost(post({ hashtags: ["iceskate"] }), reference, {
        ...defaults,
        weights: { ...defaults.weights, hashtag: 4 },
      }).score,
    ).toBe(4);
    expect(
      scorePost(post({ caption: "ローラースケート" }), reference, {
        ...defaults,
        includeRoller: true,
      }).excluded,
    ).toBe(false);
  });
});
