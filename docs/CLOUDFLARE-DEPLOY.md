# 検証用Workerの配置手順

2026-11-28。コードとローカル検証は準備済み。実Cloudflareへの配置・HTTPS公開・実メール配信はまだ行っていない。

## GitHub連携の設定

CloudflareのWorkers & Pages → Create application → GitHubで新しいアプリを設定する。GitHubの許可を追加する場合は `beino-jp/snsanalysis` だけを対象にする。既存のhatching-cs/sagyo-aiは選ばない。

| 項目 | 設定 |
| --- | --- |
| Git repository | `beino-jp/snsanalysis` |
| Worker / Project name | `beino-insight-test` |
| Git branch | `codex/prepare-live-validation` |
| Root directory | リポジトリのルート |
| Build command | `npm run build:cf` |
| Deploy command | `npm run check:cf && npx wrangler deploy` |
| Node version | `24`（ビルド環境のNODE_VERSIONで指定） |

mainには未マージなので、mainをそのまま選ばない。Worker名はwrangler.jsonのnameと一致させる。Save and Deployの前に設定内容と既存プランの利用枠を確認する。新規契約や有料プラン切替が表示された場合はその内容を確認し、ユーザーの承認なしに申し込まない。

Git連携後は選択ブランチへのpushが自動ビルド・配置を起動する。連携前と同じ感覚でpushしない。初回の配置を承認してもらう際に、この継続動作も説明する。別ブランチのPreview buildsは無効にし、同じDBやWorkflowを別プレビューへ複製しない。

公式：<https://developers.cloudflare.com/workers/ci-cd/builds/>、<https://developers.cloudflare.com/workers/ci-cd/builds/configuration/>。

### 手動作成したAPIトークンが候補に出ない場合

ユーザープロファイルでのAPIトークン作成と、Workers Buildsのビルドトークン登録は別。2026-11-29、専用トークンを手動作成後も、作成フォームの一覧にはhatching-lp build tokenと新規作成だけが表示されることを画面で確認した。同じ選択操作や無根拠な再読み込みを繰り返し要求しない。アプリ作成フォーム内の自動作成はR2/D1/全ゾーンのルート等も含むため、手動作成した権限を絞ったものを登録して使う。

ユーザーが作成した `beino-insight-test-build` はbeinoアカウントのWorkersスクリプト編集、アカウント設定読み取りだけ。新しいWorkersのEditorロール（新規作成不可）と、下段の従来のWorkersスクリプト編集を取り違えない。有効期限は画面で2027-02-27、IP制限なし。キー本文は受領していない。

登録は専用トークンにWorkers Builds Configuration（編集。旧名Workers CI編集）を一時追加し、Macで `node scripts/register-cloudflare-build-token.mjs` を使う。独立した標準Node.jsスクリプトなので単体ファイルをダウンロードして実行できる。トークンは非表示入力し、環境ファイル・引数・履歴・ログへ保存しない。

処理はトークン自己検証→許可されたアカウント一覧でbeinoを一意に照合→ビルドトークン一覧→未登録ならPOSTで登録。POSTは1回だけ、同名別キーの上書きなし、既存の他アプリ用キーは変更しない。登録後に一時追加したBuilds Configuration/CI権限を外し、元の2権限へ戻せる。Cloudflareの実登録はまだ行っておらず、3件の架空応答テストとPTYでの入力非表示のみ確認済み。

公式：<https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/>、<https://developers.cloudflare.com/api/resources/workers_builds/subresources/tokens/methods/create/>。登録APIはWorkers CI Writeを要求し、bodyはbuild_token_name/build_token_secret/cloudflare_token_id。APIトークンとbuild_token_uuidを混同しない。

NODE_VERSIONは当初4の入力だったが24へ修正済みを画面で確認。プロジェクト名・コマンド・プレビュー無効も画面で確認済み。Gitブランチの選択欄は現在の作成フォームに見えておらず、まだ対象ブランチを確定できていない。mainへ未マージのため、この問題を解決する前にデプロイを案内しない。

## 初回配置で作成・使用するもの

- 専用Worker `beino-insight-test`
- 専用Workflow `beino-insight-test-analysis` と `beino-insight-test-live-analysis`
- 既存の専用Hyperdrive `beino-insight-test-db`（キャッシュ無効）
- 日本時間09:00の日次保持期限処理

wrangler.jsonはworkers_dev/preview_urlsがfalse、routesは空。最初の配置ではアプリの公開ドメインを設定しない。分析開始は既定無効で、Apify/OpenAIのキーも初回のログイン接続確認には不要。

WranglerによるWorkflow設定権限が不足している場合は、エラーに示される必要権限を確認する。別の契約・ストレージや広いAPIキーを代替として無条件に追加しない。

## 配置後の実行時設定

Worker → Settings → Variables and Secretsで以下を設定する。ビルド用の変数と実行時の設定は別であり、ビルド用だけに入力してもログイン時に使えない。

| 名前 | 値・用途 |
| --- | --- |
| SUPABASE_URL | 専用snsanalysisのProject URL |
| SUPABASE_ANON_KEY | 専用プロジェクトのpublishable/anonキー。service_role/secretキーは使わない |
| SESSION_SECRET | 専用に生成した32文字以上のランダムな秘密 |
| ALLOWED_EMAILS | まずユーザー本人のテスト用メールのみ |
| ADMIN_EMAILS | 内部管理を許可する本人のメール |

秘密はSecretとして登録し、値をチャットやスクリーンショットで要求しない。DB接続文字列・DBパスワードは既存Hyperdriveで管理するので、アプリ設定へ再入力しない。ResendのSMTPキーはSupabaseへ設定済みのものを使い、Workerへコピーしない。

認証の設定が揃うまでアプリは設定エラーとして拒否する。設定後、初期SQL適用済みのDBへHyperdrive経由で接続できることを実確認する。

## HTTPS接続と本人テスト

上の設定が完了してから、ユーザーに `test.beino-insight.com` のログイン画面をネット上へ出す範囲を説明し、公開の確認を得る。許可メール以外は認証を拒否するが、ログイン画面自体は公開になる。DNS/Custom Domainの追加と、以降のWrangler配備で維持する設定変更を同時に扱う。現時点の設定ガードはroutes追加を拒否するため、確認後に検証ホストだけを許可する変更が必要。

実メールの招待は本人の明示された宛先・送信指示を得てから行い、AUTH-SETUP.mdのログイン試験を進める。新しい有料分析は開始しない。実API1本の試験は別途、対象投稿・最大件数・1回上限300円を提示して承認後に行う。
