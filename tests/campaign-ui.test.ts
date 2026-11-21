import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { it, expect } from "vitest";
import CampaignDiscovery from "../src/components/campaign-discovery";
it("shows the fixed budget, limited scope and mock status before any execution", () => {
  const html = renderToStaticMarkup(
    createElement(CampaignDiscovery, { jobs: [] }),
  );
  expect(html).toContain("3,000円");
  expect(html).toContain("約100アカウント・各20投稿まで");
  expect(html).toContain("課金は行いません");
  expect(html).toContain("案件の目的");
  expect(html).toContain("目的と評価基準を整理");
  expect(html).not.toContain("sample_creator_");
});
