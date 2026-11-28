# 招待ログインの設定と検証

## 実配置後に設定・ログインが失敗した場合

利用者画面のエラーだけでは原因を決めない。Cloudflareのbeino-insight-test → Observability → Eventsでエラー行を開き、アプリが出したJSONのeventが `AUTH_FLOW_FAILED` のものについてoperation / stage / reasonだけを確認する。現在のUIにLogsというメニューはない。イベントが空なら右上の時間範囲を「最後の24時間」に変更して更新する。ログインの入力や招待トークン・Cookie・SQL・DB接続文字列を共有させない。原因が分かるまで招待メールの連続送信や同じパスワード設定リンクの再利用を要求しない。

| stage | 確認する箇所 |
| --- | --- |
| configuration | 実行時設定の存在・書式。設定の値はチャットへ出さない |
| origin | APP_ORIGINと実際のHTTPSアクセス先 |
| input | リクエストの形式とパスワード条件 |
| supabase_verify | 招待リンクの認証確認、専用プロジェクトURL・キーの対応 |
| supabase_login | Supabase側でのパスワード認証、URL・キーの対応 |
| invitation_access | 確認済みメールとALLOWED_EMAILSの照合 |
| database_session | HyperdriveからのDB接続とsettingsへの読み書き。28P01はDB認証、42P01はテーブル、42501は権限を確認 |
| password_update | Supabaseへのパスワード変更。成否不明の場合も自動再送しない |
| session_cookie | アプリのセッション発行 |

診断ログは固定のイベント・段階・許可済みコードだけを出す。例外本文、プロバイダー応答、メール、キー、パスワードは記録しない。Workers Logsはアプリログを有効化し、invocationログとtraceは無効、クエリ文字列は削除する。アカウント別の情報を画面のエラーへ追加しない。

2026-11-29の実エラーはpassword_setup / password_update / UNCLASSIFIED。先行する招待トークン検証・許可メール照合・settingsへのトランザクションは通過済み。Cloudflareのworkerdで再現すると、fetchの `redirect:'error'` が未対応のためTypeErrorとなり、SupabaseへのPUTより前に失敗した。`redirect:'manual'` で送信し、3xxを含む非2xxをアプリ側で拒否する。転送先にBearerやパスワードを送らず、成否不明時の自動再試行もしない。Nodeのfetchモックだけでは見逃すため、実ヘルパーをworkerdで実行する回帰テストを維持する。

2026-11-28。専用Supabase `snsanalysis` と検証URL `https://test.beino-insight.com` を使う。既存サービスの認証・送信キーを流用しない。

## Supabaseの画面設定

1. Authentication → Sign In / Providers：Allow new users to sign upをオフ、Confirm emailをオンにして保存する。
2. Authentication → URL Configuration：Site URLを `https://test.beino-insight.com` にして保存する。
3. Redirect URLs → Add URLに `https://test.beino-insight.com/auth/finish` を追加する。ワイルドカードは不要。
4. Authentication → Emails → SMTP Settingsで専用Resendキーを設定し、Save changesで保存する。

| 項目 | 値 |
| --- | --- |
| Sender email | `noreply@beino-insight.com` |
| Sender name | `Reach Insight` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | 専用Resend APIキー。DBパスワードではない |

Resendキーは `beino-insight-supabase-test`、Sending access、`beino-insight.com` のみに制限する。キー本文をチャット・Git・ログへ出さない。ドメインのVerifiedはDNS認証完了を示すが、SMTPの保存・実際の配信成功を示すものではない。

公式資料：<https://resend.com/docs/send-with-smtp>、<https://resend.com/docs/send-with-supabase-smtp>。

## アプリの動作

Supabaseの標準招待/パスワード回復リンクのURLフラグメントを `/auth/finish` が受け取る。Site URLへ戻る標準リンクも、ログイン画面を経由してこの画面へ移動する。アクセストークンはURLから直ちに除去し、ブラウザストレージに保存しない。Refresh tokenは使わない。

本人が12文字以上の新しいパスワードを2回入力すると、サーバーがSupabaseのgetUserでトークンを検証する。確認済みメールとALLOWED_EMAILSを照合後、同一トークンの再使用をDBで拒否し、認証済みのPUT /auth/v1/userでパスワードを設定する。成功するとHttpOnlyのアプリセッションでログインする。サービスロールキー・公開サインアップAPIは使わない。

パスワード設定時にDBのセッション世代を更新し、古いアプリCookieを無効化する。既存のRLS対象settingsテーブルへトークンのSHA-256と世代情報だけを保存し、パスワード・生トークンは保存しない。この変更のために初期SQLを再実行する必要はない。

通信の成否が不明な場合もトークンは消費済みとし、自動再試行しない。画面は管理者へ新しいリンクを依頼するよう案内する。メールアプリのリンク先読みが招待リンクを消費する場合もあるため、実メールでの確認が必要。

## 送信する前の条件

専用Workerへの秘密設定、Hyperdriveからの実DB接続、許可メールと管理者の設定、検証ドメインのHTTPS配備を完了する。配備・公開はユーザー確認後に行う。第三者への招待は明示された宛先・送信指示を得るまで送らない。

その後、ユーザー本人のテスト用招待で配信→リンク→パスワード設定→ログイン→ログアウト/再ログインを確認する。期限切れ、許可外メール、公開サインアップ拒否、古いCookieの拒否も実環境で確認する。有料分析を開始する必要はない。

ローカルのSupabase応答モックとfixtureブラウザテストの成功を、実SMTP配信や実Supabase認証の成功と混同しない。
