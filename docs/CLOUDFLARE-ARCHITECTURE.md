# Cloudflare主体の検証環境（2026-11-27 方針訂正）

## 結論

専用VPSの契約を必須としない。Cloudflare Workersで画面/API、Workflowsを第一候補に段階的な分析処理、Supabase PostgreSQL/Authで保存/認証、Apify/OpenAIで取得/判定を動かす構成で検証する。
`test.beino-insight.com` を専用の検証環境へ割り当てる。
VPS用Docker構成は任意の代替案として保留。ユーザーにさくら等のVPS契約を案内しない。

先のVPS推奨は、現コードが常駐Nodeワーカーであることを配備方式の必須条件と混同していた。常駐処理を変更すれば、サーバーを借りて管理する必要はない。
ただし現在のリポジトリはまだCloudflareへそのまま配備できない。実装・ビルド・実環境検証が必要。

## 比較元を確認した証拠（他サービスは読み取りのみ）

GitHub接続で以下のdefault branchの設定を確認した。秘密情報の値は保存しない。

- `beino-jp/hatching.cs/wrangler.toml`：worker名hatching-cs、.open-next/worker-with-scheduled.js、nodejs_compat、hatching.appのcustom_domain、Cron/R2/Durable Objects等。
- 同package.json：@opennextjs/cloudflare ^1.16.3、Next 15.5.12、@tidbcloud/serverless/mysql2、Wrangler。
- `beino-jp/sagyo.ai/wrangler.toml`：worker名sagyo-ai、worker.ts、nodejs_compat、sagyoai.comとstg.sagyoai.comの分離、Cron/R2/Durable Objects等。
- 同package.json：@opennextjs/cloudflare ^1.16.3、Next 15.5.15、@tidbcloud/serverless/mysql2、Wrangler。

両サービスともコード上はCloudflareでアプリを動かす構成。TiDBの使用は今回もTiDBが必要という意味ではない。Reach InsightのSQL/ドライバーはPostgreSQL前提なので、作成済みSupabaseを維持する。
確認したソース：
- https://github.com/beino-jp/hatching.cs/blob/main/wrangler.toml
- https://github.com/beino-jp/hatching.cs/blob/main/package.json
- https://github.com/beino-jp/sagyo.ai/blob/main/wrangler.toml
- https://github.com/beino-jp/sagyo.ai/blob/main/package.json

## 必要なコード変更

1. Next.jsの画面/APIをCloudflare用にビルドする。既存2サービスのOpenNext構成を参考に互換性を確認する。最新公式では新規/移行にvinextが推奨されているため、既存Next 15と依存関係/CIの影響を比較し、未検証のアダプター変更を一括実行しない。
2. `src/worker/index.ts`の常駐whileループを使わず、ジョブを小さな段階へ分ける。Apify開始→待機/状態確認→取り込み→プロフィール取得→1人ずつAI→集計→削除の手順を永続化する。
3. Workflowsの自動再試行を有料POSTへそのまま適用しない。開始意図/課金予約をDBに記録し、成否不明の開始やAI呼び出しは停止する。取得済みの入力と応答を使って再開する。
4. Workflowsのステップ結果やログへ個人の本文を直接返さず、DBの参照IDを使う。保存期限・削除・ロール別表示を維持する。
5. PostgreSQL接続はWorkers対応にする。Hyperdrive+pgを第一候補に接続/トランザクションを検証する。現Poolのグローバル使い回しをそのまま移植しない。Supabase HTTP/RPCも代替案だが、SQLロック/予算予約の原子性を失わない。
6. ローカルCLIのファイルチェックポイントを、サーバー側DBのチェックポイントへ移す。先方にファイル操作をさせない。
7. 本番/検証を専用Worker名・Workflow名・DB・秘密で分離する。他プロダクトのルート/バインディングを変更しない。
8. 原価枠・月間予約・二重起動防止・招待認証・Originチェック・依存脆弱性の解消・ブラウザE2Eを経て公開する。

## 公式確認（2026-11-27）

- https://developers.cloudflare.com/workflows/ ：長い多段階処理と状態の永続化を提供。
- https://developers.cloudflare.com/workflows/reference/pricing/ ：CPU/リクエスト/ストレージ/ステップで課金。API待機とsleepはCPU時間に含まれない。
- https://developers.cloudflare.com/workers/platform/pricing/ ：有料はアカウント単位で最低$5/月。既存アカウントの契約・使用量は未確認。アプリごとに$5増えると決めつけない。
- https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase/ ：SupabaseのPostgreSQLをHyperdriveで接続可能。
- https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/node-postgres/ ：Workersからpgを利用できる。記載の最低pgバージョン8.16.3を確認する。
- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/ ：現在の公式推奨はvinext。OpenNextの既存環境向け案内もあり。

「VPS契約不要」は「利用料ゼロ」ではない。Cloudflareの使用量、DB枠、Apify/OpenAI料金を合算し、全体月額1万円と候補検索1回3,000円の両方を管理する。

## 次に行うこと

まずリポジトリをCloudflare用にビルドできるかローカル検証する。その後DB接続と分析段階の実行を接続し、ユーザーにCloudflareの専用Worker・Workflow・Supabase接続設定を案内する。
ユーザーが今行う追加のサーバー契約はない。既存Cloudflare/Supabase/Apify/OpenAIを利用する。

## 移植実装（作業中）

Next 16.4.5 / OpenNext 1.20.19 / Wrangler 4.168.0で `npm run build:cf` と `wrangler deploy --dry-run` のパッケージ作成を確認。専用Workerは `beino-insight-test`、Workflowは `beino-insight-test-analysis`。ルート未登録・workers.dev/preview URL無効で、公開は行っていない。

`cloudflare/entry.mjs` がOpenNextの画面/APIとWorkflowクラスをまとめる。常駐ワーカーの代わりに、DBチェックポイントを読むmock専用Workflowをジョブ登録時に開始する。実データの旧ProviderはこのWorkflowから呼べない。ステップの自動retryは無効。再開は同じWorkflowインスタンスを使う。

Hyperdriveの実IDは未設定。専用接続はリクエストまたはWorkflowの実行コンテキスト内で生成・終了し、異なるリクエスト間で使い回さない。ローカルPostgreSQLのテストとCloudflare実環境での接続確認は別物。

`npm run db:setup` はschema作成後に `db/harden-access.sql` を実行する。このSQLはアプリ18テーブルだけにRLSを有効化し、PUBLIC/anon/authenticatedから直接アクセス権を取り除く。ブラウザはアプリAPI経由でアクセスする。専用DBの所有者として実行する想定で、所有者以外のサーバーロールを使う場合は追加の権限設計が必要。他サービスの共有DBには適用しない。実Supabaseへの適用はまだ行っていない。

依存更新でZod 4/OpenAI 7へ移行。structured output schema生成をオフラインテスト済み。実APIでの回帰試験はまだ。basic-ftpとadm-zipのoverrideは間接依存の修正版を固定するため。npm auditの開発依存を含む報告は0件（2026-11-27確認）だが、安全性全般の保証ではない。

公開前に残る作業：専用Supabase/Hyperdrive/Secretsの設定、保持期限処理の定期起動、実データ取得の永続ステップ化、予算予約・二重実行防止、先方の表示権限、実環境E2E。現時点のmock完走を実データ分析完了と呼ばない。

### ローカル実行の確認結果

Wrangler/workerdとローカルHyperdrive/PostgreSQLで、署名済みテストセッションを使いHTTP登録→Workflows進行→結果取得の完走を確認。架空データ42人、progress100%。本物のSupabaseログイン・本番Hyperdrive・実API取得・ブラウザでの操作E2Eの成功とは区別する。
pg-cloudflareは接続終了後のソケットerrorを通知することがあるため、Clientのerrorイベントを処理し、connect/queryの失敗自体は呼び出し元へ返す。
