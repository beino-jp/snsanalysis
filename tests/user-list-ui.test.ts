import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import AnalyzedUsers from "../src/components/analyzed-users";
import type { AnalyzedUser } from "../src/domain/analyzed-users";
const users: AnalyzedUser[] = Array.from({ length: 42 }, (_, i) => ({
  key: String(i),
  name: `person_${String(i).padStart(2, "0")}`,
  displayName: "架空ユーザー",
  profileUrl: `/demo/profile/u${i}`,
  masked: false,
  demo: true,
  reactions: i % 2 ? ["like"] : ["like", "comment"],
  gender: "不明",
  age: "不明",
  reason: "長い属性判定根拠",
  genderConfidence: 0,
  ageConfidence: 0,
  tags: [
    {
      name: "犬好き",
      criterion: "長い選定条件の文章",
      reason: "長い根拠の文章",
      confidence: 0.9,
    },
  ],
  skate: {
    label: i < 3 ? "行った（確度高）" : "該当なし",
    score: i < 3 ? 6 : 0,
    confidence: 0.9,
    reason: "長いスケート判定の文章",
  },
}));
it("keeps the list compact and defers evidence to details, with 20 rows per page", () => {
  const html = renderToStaticMarkup(
    createElement(AnalyzedUsers, { users, channel: "unique" }),
  );
  expect(html.match(/<tr>/g)).toHaveLength(21);
  expect(html).toContain("person_19");
  expect(html).not.toContain("person_20");
  expect(html).not.toContain("長い選定条件の文章");
  expect(html).not.toContain("長い根拠の文章");
  expect(html).toContain("person_00の判定詳細");
  expect(html).toContain('rel="noopener noreferrer"');
});
it("respects reaction tabs and the high-interest shortcut filter", () => {
  const html = renderToStaticMarkup(
    createElement(AnalyzedUsers, {
      users,
      channel: "comment",
      initialSkate: "行った（確度高）",
    }),
  );
  expect(html.match(/<tr>/g)).toHaveLength(3);
  expect(html).toContain("person_00");
  expect(html).toContain("person_02");
  expect(html).not.toContain("person_01");
  expect(html).not.toContain("person_04");
});
