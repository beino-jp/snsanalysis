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
