import { test, expect } from "@playwright/test";
test("mock PR registration through segmented dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("パスワード", { exact: true }).fill("local-demo");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ダッシュボード", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "新規分析", exact: true }).click();
  await page.getByLabel("案件名", { exact: true }).fill("E2E アイススケート");
  await page.getByRole("button", { name: "デモURLを使う" }).click();
  await page.getByRole("button", { name: "見積もりを確認" }).click();
  await expect(
    page.getByRole("heading", { name: "実行前の確認" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "分析を実行", exact: true }).click();
  await expect(page.getByRole("tab", { name: /合計（ユニーク）/ })).toBeVisible(
    { timeout: 45000 },
  );
  await page.getByRole("tab", { name: /合計（ユニーク）/ }).click();
  await page
    .getByRole("navigation", { name: "分析結果の表示" })
    .getByRole("button", { name: /ユーザー一覧/ })
    .click();
  const people = page.getByRole("region", { name: "分析済みユーザー一覧" });
  await expect(people.locator("tbody tr")).toHaveCount(20);
  await people
    .getByRole("button", { name: /の判定詳細/ })
    .first()
    .click();
  const drawer = page.getByRole("dialog", { name: /demo_|非表示/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "推定属性" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await people
    .getByRole("textbox", { name: "分析済みユーザーを検索" })
    .fill("非表示");
  await expect(
    people.getByText("非表示（10代）", { exact: true }),
  ).toBeVisible();
  await expect(people.locator("tbody a")).toHaveCount(0);
  await people.getByRole("button", { name: "条件をクリア" }).click();
  await people
    .getByRole("combobox", { name: "スケート判定で絞り込む" })
    .selectOption("行った（確度高）");
  await expect(
    people.getByText("行った（確度高）", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "集計レポート", exact: true }).click();
  await page.getByRole("tab", { name: /コメント/ }).click();
  await expect(page.getByText(/取得コメント 28件/)).toBeVisible();
  await page.getByLabel("割合の分母").selectOption("all");
  await expect(
    page.getByText(/現在の割合の分母：全取得ユーザー 24人/),
  ).toBeVisible();
});

test("mobile list shows details without losing list context", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByLabel("パスワード", { exact: true }).fill("local-demo");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await page
    .getByRole("button", { name: "案件・ジョブ一覧", exact: true })
    .click();
  await page
    .getByRole("button", { name: "E2E アイススケート", exact: true })
    .first()
    .click();
  await page
    .getByRole("navigation", { name: "分析結果の表示" })
    .getByRole("button", { name: /ユーザー一覧/ })
    .click();
  await page
    .getByRole("button", { name: /の判定詳細/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "詳細を閉じる" }).click();
  await expect(
    page.getByRole("region", { name: "分析済みユーザー一覧" }),
  ).toBeVisible();
});

test("campaign purpose to ten budgeted mock recommendations", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("パスワード", { exact: true }).fill("local-demo");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await page.getByRole("button", { name: "候補を探す", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "目的から候補を探す" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "スケート案件の入力例を使う" })
    .click();
  await page.getByRole("button", { name: "目的と評価基準を整理" }).click();
  await expect(
    page.getByRole("heading", { name: "この評価基準で検索します" }),
  ).toBeVisible();
  await expect(page.getByText("3,000円 / 回", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "この条件で候補を探す" }).click();
  await expect(
    page.getByRole("heading", {
      name: "案件に合いそうな候補を10人見つけました",
    }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".recommendation-card")).toHaveCount(10);
  await page
    .getByRole("button", { name: "評価の内訳", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "発信テーマとの一致" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "評価の内訳を閉じる" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
