import { it, expect, vi } from "vitest";
import {
  probePlan,
  validatePricing,
  validateBuild,
  summarize,
  executeProbe,
} from "../scripts/lib/instagram-probe.mjs";
const plan = probePlan("https://www.instagram.com/p/TEST/?tracking=abc");
const price = {
  pricingInfos: [
    {
      startedAt: "2020-01-01",
      pricingModel: "PAY_PER_EVENT",
      minimalMaxTotalChargeUsd: 0.001,
      pricingPerEvent: {
        actorChargeEvents: { result: { eventPriceUsd: 0.002 } },
      },
    },
  ],
};
it("bounds costs and counts and strips tracking parameters", () => {
  expect(plan.url).toBe("https://www.instagram.com/p/TEST/");
  expect(plan.steps[0].input.resultsLimit).toBe(1);
  expect(plan.steps[1].input).toMatchObject({
    resultsLimit: 20,
    includeNestedComments: false,
  });
  expect(plan.steps.reduce((s, p) => s + p.cap, 0)).toBeCloseTo(0.1);
  expect(
    plan.maxChargeUsd * plan.conversionCeiling * plan.feesMultiplier,
  ).toBeLessThanOrEqual(300);
  expect(() => probePlan("https://evil.com/p/X")).toThrow();
});
it("fails closed for unknown pricing and changed actor inputs", () => {
  expect(() => validatePricing(price, plan.steps[1])).not.toThrow();
  expect(() => validatePricing({}, plan.steps[1])).toThrow();
  expect(() =>
    validatePricing(
      {
        pricingInfos: [
          { ...price.pricingInfos[0], pricingModel: "PRICE_PER_HOUR" },
        ],
      },
      plan.steps[1],
    ),
  ).toThrow();
  expect(() => validateBuild({ inputSchema: "{}" }, plan.steps[1])).toThrow();
});
it("summarizes only aggregate counts and rejects actor error rows", () => {
  expect(
    summarize(
      [
        { id: "c", text: "private text", ownerUsername: "a" },
        { id: "d", text: "x", ownerUsername: "a" },
      ],
      "comments",
    ),
  ).toEqual({ commentRecords: 2, uniqueCommenters: 1 });
  expect(() => summarize([{ error: "not found" }], "comments")).toThrow();
  expect(
    summarize([{ id: "p", likesCount: 4, commentsCount: 2 }], "post"),
  ).toEqual({ postRecords: 1, displayedLikes: 4, displayedComments: 2 });
});
it("preflights both actors before creating a paid run", async () => {
  const start = vi.fn();
  const client = {
    actor: () => ({
      get: async () => price,
      defaultBuild: async () => ({ get: async () => ({ inputSchema: "{}" }) }),
      start,
    }),
  };
  await expect(
    executeProbe(client, plan, { runs: [] }, async () => {}),
  ).rejects.toThrow();
  expect(start).not.toHaveBeenCalled();
});
function fakeClient(failStart = false, failCleanup = false) {
  const runs: Record<string, any> = {};
  let count = 0;
  const deleted: string[] = [];
  const start = vi.fn(async () => {
    if (failStart) throw Error("ambiguous");
    const id = String(++count);
    return (runs[id] = {
      id,
      status: "SUCCEEDED",
      pricingInfo: { pricingModel: "PAY_PER_EVENT" },
      usageTotalUsd: 0.002,
      defaultDatasetId: id,
    });
  });
  return {
    start,
    deleted,
    client: {
      actor: () => ({
        get: async () => price,
        defaultBuild: async () => ({
          get: async () => ({
            buildNumber: "1.0.0",
            inputSchema: JSON.stringify({
              properties: {
                directUrls: {},
                resultsLimit: {},
                resultsType: { enum: ["details"] },
                includeNestedComments: {},
              },
            }),
          }),
        }),
        start,
      }),
      run: (id: string) => ({
        get: async () => runs[id],
        waitForFinish: async () => runs[id],
        abort: async () => {},
        delete: async () => {
          deleted.push("run" + id);
        },
      }),
      dataset: (id: string) => ({
        listItems: async () => ({
          total: 1,
          items:
            id === "1"
              ? [{ id: "p", likesCount: 4, commentsCount: 2 }]
              : [{ id: "c", text: "not saved", ownerUsername: "not saved" }],
        }),
        delete: async () => {
          if (failCleanup) throw Error("denied");
          deleted.push("data" + id);
        },
      }),
    },
  };
}
it("runs two bounded steps and deletes external data without saving comment contents", async () => {
  const fake = fakeClient();
  const journal: any = { runs: [] };
  await executeProbe(fake.client, plan, journal, async () => {});
  expect(fake.start).toHaveBeenCalledTimes(2);
  expect(fake.deleted).toEqual(["data1", "run1", "data2", "run2"]);
  expect(journal.status).toBe("completed");
  expect(JSON.stringify(journal)).not.toContain("not saved");
  expect(journal.runs[1].summary.commentRecords).toBe(1);
});
it("never retries a start whose result is unknown", async () => {
  const fake = fakeClient(true);
  const journal: any = { runs: [] };
  await expect(
    executeProbe(fake.client, plan, journal, async () => {}),
  ).rejects.toThrow();
  expect(fake.start).toHaveBeenCalledTimes(1);
  expect(journal.runs[0].status).toBe("start_unknown");
  expect(journal.status).toBe("manual_check_required");
});
it("does not start a second paid step when deletion fails", async () => {
  const fake = fakeClient(false, true);
  const journal: any = { runs: [] };
  await expect(
    executeProbe(fake.client, plan, journal, async () => {}),
  ).rejects.toThrow();
  expect(fake.start).toHaveBeenCalledTimes(1);
  expect(journal.status).toBe("manual_check_required");
});
