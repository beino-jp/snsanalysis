# 作業再開メモ — 2026-11-26（日本時間）

## 最優先の依頼

ユーザーは本日は終了。新しい有料取得・分析は実行しない。
次回は「不足するデータをどう補うか」を検討済みの状態から始め、検証と実装をスムーズに再開する。
ユーザーの目的はユーザー名・コメント一覧ではなく、属性・どんな人か・案件に合うかの判断。
ユーザーはエンジニアではない。Macの画面とクリック箇所を具体的に、コマンドはコピー可能に案内する。
根拠なくUIラベルやAPI仕様を断定しない。繰り返しのZIP更新・スクリーンショット依頼を減らす。
秘密や実データJSONをチャットに要求しない。

## 目的と制約

- InstagramのPR投稿の反応ユーザーを分析。属性、関心、タグ、選定条件、根拠、プロフィール導線。
- 案件目的を聞き、不足条件を質問、配点を確認し根拠付きの適合スコアを出す。
- 新規候補探索は100プロフィール×直近20投稿まで比較、最大10人推薦。1回3,000円上限。
- 利用者5人未満、月額運用10,000円以内を目指す。
- 今回の少量検証は別枠300円。プロフィール取得の累積API枠0.10 USD。
- 将来は先方にテストしてもらえる共有開発環境。Cloudflare DNS、常駐アプリとワーカーのサーバー、Supabase DB/認証を構成案として提示。契約・デプロイは未完了。
- 画像非保存、実個人情報は90日削除方針。ローカルファイル自動削除は未実装。

## 保存場所と起動

- 開発ソース `/workspace/reach-insight`。
- GitHub `beino-jp/snsanalysis`。ブランチ `codex/prepare-live-validation`、PR #1。
- このメモ作成前の先頭コミット `3e1c4b4`。mainへマージしていない。
- ユーザーのMacは `~/Downloads/reach-insight`。ZIPで更新している。git clone前提にしない。
- Macの `.env` にAPIFY_TOKEN、OPENAI_API_KEY。クラウドに秘密はない。
- DATA_PROVIDER=mock、LLM_PROVIDER=mock、DEMO_AUTH=trueを基本に、少量実検証は専用CLIのみ。Webの全体パイプラインを実データ化したわけではない。
- OpenAIは専用Project、Chat completionsのRequest権限。gpt-4.1-mini。
- MacにOpenAI入力0.40/output1.60 USD per millionを設定。次回使う前にモデルの現行料金・利用可能性を公式で再確認する。
- Docker Desktopが開いていてもDBが停止していることがあった。

```sh
cd ~/Downloads/reach-insight
docker compose up -d --wait db
npm run db:setup
npm run dev
```

ブラウザ `http://localhost:3000`。起動ターミナルは開いたままにする。
別コマンドは別ターミナル（Command+N）で実行。

## 実検証の到達点（ユーザーのMacとスクリーンショットで確認）

1. 投稿情報1件とコメント15件・ユニーク15人の取得成功。
2. 表示いいね6,124、表示コメント93、取得率16.1%。投稿全体・いいね全体を代表する標本ではない。
3. 初回probeは本文・ユーザー情報を残さず外部保存先を削除。集計だけUI取込成功。
4. retain-comments版で本文・ユーザー名保存、UI一覧・Instagramプロフィール導線成功。
5. プロフィール取得とAIによる属性・関心分析が15/15処理完了し、audience JSONをUIへ取込成功。
6. 表示は性別：女性1人・不明14人、年代：不明15人。公開情報がある一部は旅行・ダイビング・ゴルフ等や犬好きを抽出。非公開・情報不足が複数あり。正確な内訳はスクリーンショットだけでは不明。
7. 明示的自己記述から属性を判定している。氏名・容姿・絵文字で補っていない。
8. AIの自己評価100%が多く表示され、校正済み精度のように見える問題がある。
9. 集計→個別明細のUIに改善余地。処理完了人数と、根拠を持って判定できた人数を区別すべき。

実対象URLは公開ソースや本メモに追加しない。クラウドの `.live-test.local.json` 等のローカル記録と、この会話の既存URLを参照。
実ユーザー名・本文・プロフィールはpublicリポジトリに入れない。

## ローカルファイルと取込

ユーザーMacの `.p0-results/` に以下の種類がある。
- `probe-投稿ID.json`：集計のみ。
- `comments-投稿ID.json`：コメント本文とユーザー名。
- `audience-投稿ID.json`：分析済み。現在の成果物。再取得せず使う。
- `.preflight-*`、`.before-recovery-*`：過去記録を保全したもの。削除しない。

ブラウザの「実データの取得記録」で投稿URLとaudience JSONを指定。
ファイル選択画面でCommand+Shift+G、`~/Downloads/reach-insight/.p0-results/`。
取込だけではAPI課金しない。DBのvalidation_reportsは90日削除対象。
JSONには個人情報があるのでアップロード・Git共有しない。

## 重要な実装

- `scripts/lib/instagram-probe.mjs`：Apify料金とBuild入力を事前確認、PPE課金枠、開始の自動retryなし、成功と費用の確認、外部保存先とrun削除。
- `scripts/probe-instagram.mjs`：dry-run既定、--executeで有料取得、--retain-comments明細保存、exclusiveファイルで二重実行を防止。
- `scripts/analyze-audience.ts`：comments JSONから最大20人、プロフィール取得→AI分析。自己紹介とプロフィール応答に含まれる投稿テキスト最大20件、AI入力本文合計1500文字/人。画像なし。投稿専用Actorでの追加取得はまだない。
- `src/domain/audience.ts`：出力schema、引用が実入力に存在するか確認、低confidence/根拠不足は不明。自由作文descriptionは検証済み関心タグから再生成。
- `scripts/check-audience-ai.ts`：架空データだけの少額AI診断。実行済みで通信/strict出力成功、798 tokens。
- `scripts/lib/audience-errors.ts`：秘密や本文を除いたHTTP状態・schemaパスを表示/記録。
- `scripts/lib/audience-recovery.ts`：旧版の保存欠落だけを一度明示的に復旧し、過去取得費を差し引いた残りの枠に制限。
- `src/domain/validation-report.ts`、`src/app/api/validation-reports/route.ts`、`src/components/validation-reports.tsx`：取込・DB保存・属性UI。取込は外部照合済みを保証するものではない。
- メインのmock PR解析/目的スコア/候補推薦の実データProvider接続は未完了。

## 遭遇した不具合と現状

- Profile ScraperのPPEはprofileとabout-accountの2項目。最初のコードは1項目限定で停止。
- 公式料金・Buildをread-onlyで確認して修正。profile最大単価0.0026、15人で0.039 USD。includeAboutSection:falseで追加オプションを明示無効化。既知2項目以外は停止。
- 確認時のプロフィールBuildは0.0.705。実行の都度仕様を確認し、そのBuildをpinする。
- 旧AI出力はJSON object指定だけでCHECK_REQUIREDに停止。真の例外は旧版が保存しておらず断定不能。structured outputsに変更し、架空・実15人の分析で完走確認済み。
- 旧版はAI失敗時にプロフィールがメモリだけにあり外部は削除済み。今回一度再取得した。
- 修正版は個人情報を最小化したprofileInputsをAI前に保存、atomic JSON保存。--resume-analysisは保存済み入力から再開してApifyを呼ばない。
- --recover-missing-inputsは今回実行済み。次回同じフラグを案内しない。通常の再分析/再取得を勝手に始めない。
- .operation-lockは並列実行を防ぐ。SIGKILL後の残存を無条件に削除しない。
- 未保存のAI通信失敗は請求状態が不明の場合がある。自動retryをしない。

## 次回最初に行うこと（API課金なし）

1. このメモとdocs/DATA-GAPS.mdを読む。git statusと現在ブランチを確認。
2. 既に完了したaudienceのprofileInputsを、ユーザーMac内だけで集計する診断を作る。
   公開/非公開/取得失敗/自己紹介空/投稿件数/入力切捨て量/根拠あり/属性不明理由を、個人名なしの件数で出す。
3. 追加取得が必要な原因と、公開情報では解決不能な原因を分ける。
4. 同じ保存データを使ってUIを修正。情報充足率と分母を先に、関心タグの正規化集計を次に、個別根拠は折り畳み。自己評価100%を精度保証のように出さない。
5. 次の有料検証は対象・追加取得範囲・上限と予測改善を具体化してから案内。
6. データ充足性が足りなければ案件適合を無理に数値化しない。

## 品質・運用の未完了

- 最終確認：typecheck成功。54 tests passed、DB 5 skipped（計59）。直近CLI修正時に本番ビルドは再実行していない。以前のWeb変更時は成功。
- 外部キーなしのクラウド単体テストと、ユーザーMacでの実API検証を区別。
- DBテストはRUN_DB_TESTS=trueで、Docker起動とdb:setup後に実行する。
- 公開テスター環境は未提供。招待認証、権限、失効、rate limit、HTTPS、監視/バックアップ/復旧、外部削除失敗監視、月間予算のhard stopが必要。
- 現在のローカルDEMO_AUTHをそのまま外部公開しない。
- OpenAI/Apifyの費用実績をUIへ統合できていない（投稿コメントの費用欄にはプロフィール/AI費を含まない旨を表示）。予約・実績照合を完成させる。
- ブラウザプレビューrelayは過去失敗。ユーザーMac画面で実動確認。未実施のE2Eを成功と報告しない。

## 次回の会話開始例

「前回の15人の分析は保存済みなので、取り直さずに情報不足の内訳を確認するところから再開します。」

## 2026-11-27 再開時の追記

ユーザーが再開を指示。既存データの情報充足性を調べる `scripts/audit-audience.mjs` と `scripts/lib/audience-coverage.mjs` を追加した。
外部通信・API課金・ファイル更新なし。Mac内の最新の完了済みaudience JSONを探し、非公開/公開/対応なし、自己紹介・投稿本文不足、1500文字枠による切り捨て、根拠あり属性・関心人数を個人名なしで表示する。
保存前に削った文章やInstagram上の未取得投稿数は不明であることを明示する。
次の依存作業は、ユーザーMacでこの診断の件数を確認すること。まだ追加取得やAI再実行は案内していない。
実データの診断結果はまだ得ていない。公開情報なしが原因か入力配分が原因か断定しない。

```sh
cd ~/Downloads/reach-insight
node scripts/audit-audience.mjs
```

更新ZIPは `reach-insight-coverage-check.zip`。中身は診断スクリプト2ファイルだけで、アプリ停止・Docker起動・npmインストールは不要。

### 診断結果受領とUIの改善

2026-11-27、ユーザーMac診断で公開8/非公開7、公開で本文あり6、両方なし2、56投稿使用、1500文字枠の切り捨て0、性別判定1/15・年代0/15・関心5/15を確認。詳細はDATA-GAPS.md。
投稿者からInsights集計の提供は難しいとの回答。提供を前提にしない。

`audience-overview.tsx`を追加し、情報充足率・公開/非公開・関心タグ集計を先に表示、個別根拠はdetailsで折りたたみ、confidence百分率強調を廃止。
元のaudience JSONのprofileInputsから集計だけを計算してDBに残す。profileInputs本文そのものは取込payloadから落とす。
同一記録を再インポートするとpayloadを更新するため、再取得なしでcoverageを追加できる。created_atを変えず保持期限を延ばさない。
未インポートのcoverageはゼロ扱いにせず再読み込み案内を表示。
記録末尾の「属性未実施」等の古い文言も分析済みかどうかで切り替える。

更新ZIP `reach-insight-coverage-ui-update.zip`。既存audience JSONを再読み込みするだけで追加課金なし。
単体/HTMLテスト61成功・DB5スキップ、typecheck成功、本番ビルド成功。実ブラウザでの変更後の確認はまだ。

## 先方テスト環境へ向けた最新方針

ユーザーは非公開・投稿なし・根拠不足は不明でよいと明示。ゴールを、先方が共有URLにログインして投稿URLだけで検証できる状態と再確認。技術に不慣れな利用者のUIUXを重視する。
詳細な受け入れ条件と実装順はdocs/CLIENT-TEST.md。
今回、URL優先の任意設定入力、招待ログイン表示、production設定ガード、既存セッションの許可リスト再確認、Origin制限、Docker/Caddy/Web/worker分離構成とヘルスチェックを追加。
先方へ公開する作業はまだ行っていない。ブラウザの実データ実行は未接続で、次の主要タスク。CLIを案内し続ける方針にはしない。

共有環境用Docker imageのビルドと、コンテナ内で未設定のproduction構成が拒否されることを確認。
npm auditは12件（moderate2/high8/critical2）を報告。外部公開前の依存更新・実行時依存分離を残課題としてdocs/CLIENT-TEST.mdに明記。
ユーザーはCloudflareやTiDB等、必要なサービスの設定を自身で進められると申し出。Cloudflareでテスト用HTTPSの名前を管理し、DBは作成済みSupabase/PostgreSQLを継続する方針を説明。TiDB追加は不要。ドメイン取得/サーバー契約/秘密設定はまだ実行していない。

## ドメイン取得完了（2026-11-27）

ユーザーがCloudflareで `beino-insight.com` を購入し、画面でアクティブ/登録完了通知を確認。自動更新オン、有効期限2027-11-27、表示更新価格11.17 USD/年。
検証用ホストは `test.beino-insight.com` にする方針。DNS接続先はサーバー決定後に設定する。登録完了メールと、別途必要な場合の登録者メール認証を混同しない。
CloudflareアカウントID・連絡先・支払情報は保存しない。
サーバーは依然未契約。公式確認した候補：さくらのVPS Linux 2GB/石狩/毎月払い 1,738円/月、初期費用無料（https://vps.sakura.ad.jp/specification/）。最低利用期間3ヶ月（2026-11-11更新の公式contract-guide）、クレジットカード申込は条件付き2週間試用、終了後は本登録に移る。まだ購入を実行していない。
2GBは少人数の限定検証の出発点であり、性能保証ではない。ビルドは別環境で行うかメモリ使用量を確認する。API利用料・バックアップ等はサーバー料金と別。
Windows Serverプランや年払いの月額換算価格を案内しない。最新の申込画面の金額/試用/期間条件を確認してから契約する。

## 最重要の訂正：VPSは不要の構成へ

ユーザーから「hatching-cs/sagyo-aiはサーバー契約不要だった。今回VPS必須か」と指摘。
接続GitHubから両repoのwrangler.toml/package.jsonを実際に確認し、Cloudflare Workers/OpenNext/TiDB構成であることを確認した。今回も専用VPSを必須とする理由はないと回答し、契約案内を止めた。
最新の第一方針はCloudflare Workers + Workflows等の段階実行 + 既存Supabase。詳細・証拠・公式資料・必要な移植はdocs/CLOUDFLARE-ARCHITECTURE.md。
今のコードはまだCloudflareにそのまま配備できない。常駐whileループ、pg Pool、ローカルファイル依存を変更する必要がある。次はアダプタービルド検証から。VPS/Dockerは保留の代替案。
他プロダクトのCloudflareリソース・ルートを変更しない。既存アカウントで追加課金が不要とも未確認なので約束しない。

## 2026-11-28 JST Cloudflare移植の作業中

ユーザーは既存契約を使った実装継続とブラウザ操作を許可。追加契約・既存サービスへの影響・公開・有料実検証は重要事項として確認する。専用VPS不要。
作業ツリー未コミット：Next16.4.5/OpenNext1.20.19/Wrangler4.168.0へ更新しCloudflareビルド成功。wranglerは専用beino-insight-test、routes空、workers_dev/preview_urls false。デプロイなし。Hyperdrive用のリクエスト別pg接続とALS、mock専用Workflows雛形、ジョブ作成/再開dispatchを追加。実データWebパイプラインは未完成。Hyperdrive/Secrets未設定。
型確認成功、DBを起動して全74テスト成功。Cloudflare最終ビルド成功。wranglerラッパーのdry-run/実行時検証はまだ。runtime npm auditはhigh7（zod<4.6.6、openai経由zod、Apify経由basic-ftp等）残り、公開前に修正が必要。
Browser skillはあるが関連js/list_tabsツールが未提供。CUAで見えたのはクラウドChrome tabs空でユーザーMacではない。ユーザーは接続状態不明、その後「ポップを出せば接続を押せる」と依頼。ツール一覧再検索でも接続要求ツールなし。plugin検索Browserは別製品候補のみ。ポップ表示済み・接続済みと偽らない。ユーザー側Chrome拡張の接続画面確認が次。秘密をチャットへ送らせない。

### 2026-11-28 JST 続行結果（最新）

ブラウザ接続の追加調査は終了。ユーザーChrome拡張は有効だが、このCodexにはローカルBrowserツールがない。再読み込みや追加スクリーンショットで解決を繰り返さない。ユーザーは開発継続を指示。

Cloudflare移植はローカル実行まで成功：Next16.4.5/OpenNext1.20.19/Wrangler4.168.0、専用Worker+Workflow、Hyperdrive(pg)でHTTP health200、署名済みテスト認証→ジョブ登録200→Workflows自動進行→completed100%/架空分析42人。専用ローカル設定は.wrangler/smokeにあり無視対象、HTTP8793。実Cloudflare配備・DNS変更・実Supabase接続は未実施。初回はpg-cloudflareの接続終了後errorイベントで失敗したため、Clientにerrorリスナーを置きconnect/queryの拒否は維持して修正し、完走を確認。実行ログのsocket errorsも解消。

OpenAI7.65.0/Zod4.6.7/Vitest5.1.2へ更新、basic-ftp6.2.6/adm-zip0.6.1を間接依存override。structured-output生成と既存機能の回帰確認、型チェック成功、DB含む80テスト成功、npm audit全依存0件。Cloudflareビルドとdry-run成功。実OpenAI/ApifyのAPI回帰はまだ行っていない。

db/harden-access.sqlを追加しdb:setupへ接続。18アプリテーブルのRLS有効化とPUBLIC/anon/authenticated権限撤去。ローカルのみ適用/テスト済み。専用Supabaseへはまだ適用していない。他サービス共有DBに適用しない。

実Web分析は未接続のまま。次の主要実装：取得CLIの永続DB化、予算/月間予約・重複防止・有料開始不明時停止、URL確認UI、所有者/先方表示範囲、90日削除定期処理。次の外部依存：専用Supabaseの確認・Hyperdrive/Secrets設定をユーザーにクリック順で案内（秘密はチャットに不要）。追加課金/公開前は確認。mainへのマージ・公開はしない。

## 2026-11-27 実データWeb接続の追加（最新）

ユーザーの「続けて」指示で `/analyze` のURL→300円上限確認→チェック→開始→履歴/属性・関心集計と専用API/LiveAnalysisWorkflowを実装。外部APIは実行していない。
- LIVE_ANALYSIS_ENABLEDは既定無効。DEMO_AUTH=false/専用署名鍵/固定gpt-4.1-mini・入力.4出力1.6/キー/月間API枠300〜6000円を要求する。CloudflareのLIVE_ANALYSIS_WORKFLOWとHyperdriveが必要。
- SQL live_analyses/live_operations/live_budget_months追加、RLSも対象に。300円原子的予約、同requestKey重複と実行中同URLの再取得防止、日本時間月次API枠、完了時USD×300の円換算目安で一度だけ精算。不明課金は予約を残して手動確認。固定費別なので月額1万円は契約プラン確認が必要。
- live/pipeline.tsは既存executeProbeで投稿/コメント→プロフィール取得と外部削除、20人まで1人ずつAIへ。全有料単位の開始意図を先にDB保存し、成否不明なら再実行しない。自動retry0。AI応答を解析前に保存。投稿者本人は除外、非公開/材料なしは不明。成功時チェックポイント削除。server reportのAPI出力は集計だけ。
- ADMIN_EMAILSを新設し、旧内部APIと個別検証記録は内部担当者のみ。招待先方は `/` から `/analyze` へ。ホームSSRで認証確認。ローカルDEMO_AUTH=trueの既存デモは維持。
- Cloudflare Cron日次00:00UTC(09:00JST)で期限処理。90日データ削除、新規分析1時間以上未完了を手動確認へ。外部削除失敗の管理画面/手動再開・監視運用はまだ。
- 型チェックとDB含む87テスト成功。外部をfakeにしたパイプラインの取得〜精算、所有者排他、二重課金/曖昧開始拒否を確認。Cloudflareビルド成功、HTTPでclient内部API拒否/ホーム転送/準備中画面/無効時ジョブ未作成を確認。
- Playwright/Chromiumで375px/1440pxの2件E2E成功。費用確認・チェック・開始・結果、横幅を確認。ブラウザの新API応答はテストfixture、実APIを呼んでいない。test-results/live-375.png/live-1440.pngは架空データのみ。
- 実接続はまだ。Cloud environment statusはsecrets/runtime_variables/outbound_identitiesなし、HTTP portalなし。ローカルBrowserも使えない。秘密をチャットに要求しない。Supabase専用プロジェクトか確認する非同期質問を送信済み、未回答なら回答待ち。質問：Supabaseの「snsanalysis」は今回専用/他サービス共用/不明。既存サービスDBへ誤適用しない。
- 次は実Supabase/Hyperdrive/Secretsの安全な設定、SDK更新後の実APIで1本検証（範囲・上限を提示して事前確認）、招待ログイン/実環境E2E。公開と追加課金は未実施。ブラウザ連携の追加スクリーンショット探しを再開しない。

Supabaseの「snsanalysis」は今回のアプリ専用とのユーザー回答を受領。他サービスと共用ではない。接続操作はまだで、実際のキー/DB情報はクラウドにない。専用DBへの設定を案内するところから再開する。APIキー・DBパスワードをチャットに送らせない。

## 2026-11-28 Hyperdrive接続構成をユーザーが作成

ユーザーのCloudflare beinoアカウントで `beino-insight-test-db` を新規作成。Supabase専用snsanalysisのSession pooler、Postgres/5432/postgresを手動入力し、DBパスワードは本人が思い出してCloudflare画面へ直接入力。チャット・repoには受領/保存していない。設定画面の「この構成ではキャッシュが無効です」を確認済み。最大接続数は画面上60（soft limit）、まだ変更していない。
接続方法wrangler.jsoncのスクリーンショットでHyperdrive ID `01a91508d92d4491aa2a72c17d6c96ca` とbinding HYPERDRIVEを確認し、wrangler.jsonに反映。IDは認証秘密ではない。接続文字列/ローカルDBパスワードはwrangler設定に含めず、ガードで禁止。
Cloudflare設定作成は確認済みだが、アプリから本物のDBへのSQL実行は未確認。既存Worker/DNS/ルート変更・公開・有料取得はまだ。
次はSupabase SQL Editorでアプリ初期設定を行う。`scripts/export-supabase-setup.ts` が既存schema+RLS+default設定をトランザクション付きの `attachments/supabase-setup.sql` にオフライン出力。専用DBだけで使い、21テーブル作成/権限設定/初期設定を行う。既存設定はON CONFLICT DO NOTHINGで保持、DROP/DELETEなし、Auth変更なし。ローカルDBへ2回適用し21テーブル/RLS有効を確認。本物のSupabaseには未適用。SQL Editorを開いてもらい、用意したSQL全体を渡すところが次のユーザー操作。

### 専用Supabaseの初期SQL実行成功を受領（2026-11-28）

ユーザーがsnsanalysisのSQL Editorへattachments/supabase-setup.sql全体を貼り付けRunし、Resultsに「初期設定が完了しました」のresult行が表示されたスクリーンショットを受領。画面末尾はCOMMITとSELECT。初期設定SQLの実行成功を確認したので、同じSQLの再実行は不要。Hyperdrive経由の実アプリ接続確認とは区別する。
次はSupabase Authentication（左端の南京錠アイコン）を開いて、招待だけのログイン設定を案内。まだ公開サインアップ無効化・招待/SMTP・ログイン実テストは未確認。API/DBパスワードはチャットへ要求しない。

### Supabase認証/メール送信の画面設定（2026-11-28）

ユーザーへAuth Sign In / ProvidersでAllow new users to sign upをオフ、Confirm emailオン維持、Save changesを案内。その後ユーザーは「できた」とURL Configuration/Emails画面を提示。保存後スイッチの直接再確認はしていないので、無効化の実テストは未完了。Site URLにhttps://test.beino-insight.comを保存するよう案内し、ユーザーが保存後Emails画面へ進んだ。Redirect URLsはまだ未設定。
SMTP SettingsはEnable custom SMTPオフをスクリーンショットで確認。既存hatching.cs/sagyo.aiのpackage依存とsagyo.ai README/環境型からResend使用構成を確認。既存Resendのsagyoaiチームでsagyoai.com Verifiedをユーザー画面で確認。
ユーザーがResendへbeino-insight.com/Tokyoを追加しAuto configure操作後、Domain added / Checking DNS / Pending画面を受領。Cloudflare承認画面自体の変更範囲は確認前にユーザーが進んだので、既存ドメインへ影響なしと断言しない。新規メール送信・プラン変更は案内していない。
公開DNSのGoogle DoH照会でresend._domainkeyのTXT(DKIM)とsendのTXT(SPF)を確認。sendのMX回答も存在するが、Resend画面の期待値との一致はまだ未照合。ResendのVerified表示はこれから。SMTP専用APIキーは未作成、SMTP設定もまだ。
重要な実装残課題：招待/パスワード設定リンクの受取経路がまだない。現ログインはsignInWithPasswordのみ。招待メールを送る前にcallback/パスワード設定を実装して検証し、Redirect URLを具体的に設定する必要がある。現状態で先方への招待を送らせない。

### 招待リンク受取の実装とResend認証完了（2026-11-28 最新）

ユーザーからResendのbeino-insight.comが **Verified** になったと回答を受領。DNS公開照会ではsendのMXがfeedback.forge.rmta.net（Resend Forge）だったため、SESのMXでないという理由で誤設定と判断しない。既存sagyoai.comやproductionキーは変更していない。
専用Resend APIキーをName beino-insight-supabase-test / Sending access / beino-insight.comで作成するよう案内し、ユーザーが作成済みと回答。SMTP設定はhost smtp.resend.com / port465 / username resend / sender noreply@beino-insight.com / name Reach Insight、Passwordに新APIキー全文を入力するよう案内。ユーザー「できた」を受領したが、保存済み画面・実メール送信は未確認。キー・DBパスワードは受領していない。

`/auth/finish` に招待/回復リンク→12文字以上パスワード2回入力→ログインを実装。標準Site URLへの戻りもフラグメントを受取画面へ渡す。URLからトークンを直ちに消し、ブラウザストレージ/アプリCookieには残さない。サーバーgetUserで検証し、確認済みメールと許可リストを照合してからパスワード更新。同一トークンは一度だけ消費し、パスワード変更時に既存アプリセッションを無効化。成否不明時は自動再試行せず新リンクを案内する。既存settingsテーブルにトークンハッシュと世代情報を置くため、追加SQL手作業は不要。

型チェックとローカルDBを含む92テスト、Cloudflareビルド成功。ブラウザfixtureは5件成功：標準招待URLの転送/URL消去と不一致入力/API失敗時の再実行防止、設定成功後のログイン画面遷移、期限切れ、375px/1440pxで分析費用確認→開始→集計。Supabase認証応答・パスワード更新は単体テストで模擬し、実Supabase/SMTPは未使用。HTTPのno-store/no-referrerヘッダーと375pxのパスワード画面も確認。詳しい画面設定と実確認条件はdocs/AUTH-SETUP.md。
次はSupabase Authentication → URL Configuration → Redirect URLsへ `https://test.beino-insight.com/auth/finish` を追加するよう案内（まだユーザーの完了報告なし）。その後、専用Workerの秘密設定/実DB接続・HTTPS配備を進める。公開・プラン変更・有料実分析・先方招待は未実施で、重要事項は確認する。

### 戻り先URL登録を画面で確認（2026-11-28）

ユーザーのスクリーンショットでRedirect URLsがTotal URLs:1、`https://test.beino-insight.com/auth/finish` と一致することを確認。追加は完了しているので繰り返し要求しない。
次はCloudflare Workers & Pages → Create application → GitHub → beino-jp/snsanalysisを選び、新規Workerの設定画面へ進むよう案内。アプリ名beino-insight-test、対象ブランチcodex/prepare-live-validation、Build npm run build:cf、Deploy npm run check:cf && npx wrangler deploy。まだSave and Deployの許可・実行はしていない。公式のGit連携手順とビルド変数/実行時Secretsが別である点を確認し、docs/CLOUDFLARE-DEPLOY.mdに手順を整理した。
実行環境statusを再確認：Cloudflare/Supabaseの秘密・実行時変数・外部認証の設定はない。ユーザーのMacブラウザへ接続する手段も未提供のまま。Cloudflare画面で直接設定してもらい、チャットへキーを送らせない。初回は非公開Workerの配置と認証接続確認、HTTPS公開・本人招待・有料分析はそれぞれ条件が揃ってから扱う。

### 2026-11-29 ビルド用トークン登録が次の操作

ユーザーがCloudflare作成フォームへプロジェクト名beino-insight-test、Build npm run build:cf、Deploy npm run check:cf && npx wrangler deploy、Preview buildsオフ、Root /、NODE_VERSION24を入力済みと画面で確認。Gitブランチ欄はこのフォームに見えておらず、まだcodex/prepare-live-validationに設定できていない。mainへ未マージのままなのでデプロイを案内しない。
標準の新規ビルドトークンは多数の不要製品/全ゾーン権限を持つため、プロファイルからbeino-insight-test-buildを手動作成。対象beino全体、Workersスクリプト編集（上段の新Workers Editorとは別）、アカウント設定読み取り、期限2027-02-27/IP制限なしを概要で確認。ユーザーが作成・保存を完了したと報告。本文は受領していない。
誤案内：手動作成したトークンが作成フォームの候補に自動表示されると想定し、同じプルダウン選択/スクリーンショットを何度も要求してしまった。最終的に開いた候補はhatching-lp build tokenと新規作成だけ。ユーザーの操作の問題ではない。公式APIでユーザーAPIトークンとBuilds登録が別管理と確認。hatching-lpキーは変更/流用しない。
`scripts/register-cloudflare-build-token.mjs` を用意。標準Nodeだけで実行し非表示入力、token verify→beino照合→登録済み一覧→POST /accounts/:id/builds/tokensで既存キーを登録。秘密は保存/印字しない、同名別キー上書き・自動再試行・配備なし。新規3テスト成功、型確認成功（最終出力参照）、PTYで入力非表示成功。ユーザーの専用トークンに一時的なWorkers Builds Configuration編集（旧Workers CI編集）が必要なので次に追加を案内する。値はチャットへ送らせない。実登録はユーザーMacで行い、成功後に一時権限を外せる。ダウンロード用の同一ファイルをattachments/register-cloudflare-build-token.mjsへ用意。

### 2026-11-29 ビルド用トークンの実登録成功

ユーザーが専用トークンを編集し、検索Workers CIで表示された「Workers Builds 構成」の編集を追加・保存したと報告。その後Macで登録用mjsをダウンロードしてnode実行。非表示入力のため貼り付けが効かないと見えたが、Control+U→Command+Vを一度→Enterを案内し、「ビルド用トークンの登録が完了しました。」の出力を受領。実登録成功が確認できたので、再作成・再登録を案内しない。キー本文はチャットへ受領していない。
登録にだけ使ったWorkers Builds構成編集は、このあと外す（未完了）。元のアプリ作成画面の選択候補へ反映するには画面再読み込みが必要な可能性があるので、再読み込み時は入力済みの専用名/コマンド/Node24/Preview off/Root /を復元する。まだ登録済みトークンをUIで選べた画面は未確認。
GitHubを確認：repoはPUBLIC、default branch main、PR#1 OPEN/MERGEABLE、最新headの2つのCI verifyがSUCCESS。mainのpackage.jsonにはbuild:cf/check:cfがまだない。Cloudflare公式Build branchesは初回にrepo default branchを使用し、作成後Settings > Build > Branch controlで変更する手順を記載。作成画面にブランチ選択が見当たらないため、テスト済みPRをmainへ取り込む案をユーザーへ重要事項として確認する。確認が来るまでマージしない。Cloudflare配備/HTTPS公開/有料分析の承認とは分ける。
