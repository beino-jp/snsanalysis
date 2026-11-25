import "dotenv/config";
import { ApifyClient } from "apify-client";
import { mkdir, open, writeFile } from "node:fs/promises";
import { probePlan, executeProbe } from "./lib/instagram-probe.mjs";
const args = process.argv.slice(2),
  i = args.indexOf("--url");
try {
  if (i < 0 || !args[i + 1])
    throw Error("--url に検証用の公開投稿URLを指定してください");
  const plan = probePlan(args[i + 1]);
  console.log(
    JSON.stringify(
      {
        mode: args.includes("--execute") ? "paid-execution" : "dry-run",
        url: plan.url,
        scope: "投稿情報1件・コメント最大20件（返信なし）",
        apiCeilingUsd: plan.maxChargeUsd,
        budgetYen: plan.budgetYen,
        conservativeYen: Math.ceil(
          plan.maxChargeUsd * plan.conversionCeiling * plan.feesMultiplier,
        ),
        retainComments: args.includes("--retain-comments"),
        note: "無料プランではコメント15件に制限される場合があります。いいね一覧・属性判定・OpenAI呼び出しは行いません。",
      },
      null,
      2,
    ),
  );
  if (!args.includes("--execute")) {
    console.log("外部通信なし。実行には --execute が必要です。");
    process.exit(0);
  }
  if (!process.env.APIFY_TOKEN?.trim()) throw Error("APIFY_TOKENが未設定です");
  await mkdir(".p0-results", { recursive: true, mode: 0o700 });
  const retain = args.includes("--retain-comments");
  const file = `.p0-results/${retain ? "comments" : "probe"}-${plan.shortcode}.json`;
  // Exclusive file creation prevents double charging from repeated commands or two terminals.
  const handle = await open(file, "wx", 0o600).catch(() => {
    throw Error(
      "同じ投稿の検証記録が既にあります。自動再実行せず記録とApify Consoleを確認してください",
    );
  });
  const journal = {
    status: "created",
    startedAt: new Date().toISOString(),
    budgetYen: plan.budgetYen,
    maxChargeUsd: plan.maxChargeUsd,
    runs: [],
  };
  const save = async () =>
    writeFile(file, JSON.stringify(journal, null, 2), { mode: 0o600 });
  await handle.close();
  await save();
  try {
    await executeProbe(
      new ApifyClient({ token: process.env.APIFY_TOKEN, maxRetries: 0 }),
      plan,
      journal,
      save,
      retain ? async (key, items) => {
        if (key === "comments") {
          journal.comments = items.map(p => ({username: p.ownerUsername ?? p.owner?.username ?? null, text: p.text.slice(0, 4000)}));
          await save();
        }
      } : undefined,
    );
  } catch {
    if (journal.status !== "manual_check_required") journal.status = "stopped";
    await save();
    throw Error(
      `検証を停止しました。${file} とApify ConsoleのRunsを確認してください。自動で再試行しないでください。`,
    );
  }
  console.log(
    "実取得と外部保存先の削除を確認しました。明細保存を指定した場合、コメントはローカルJSONに含まれます。",
  );
  console.log(JSON.stringify({...journal, comments: journal.comments ? "ローカルファイルに保存（画面出力なし）" : undefined}, null, 2));
} catch (e) {
  console.error(e instanceof Error ? e.message : "検証を停止しました");
  process.exitCode = 1;
}
