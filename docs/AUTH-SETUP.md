# 招待ログインの設定と検証

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
