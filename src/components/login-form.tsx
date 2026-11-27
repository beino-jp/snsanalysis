"use client";
import { useState } from "react";
import { BarChart3, ShieldCheck, Loader2 } from "lucide-react";
export default function LoginForm({demo=false}:{demo?:boolean}) {
  const [email, setEmail] = useState(demo ? "demo@reach.local" : ""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      location.href = "/";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-story">
        <div className="brand">
          <span className="brand-symbol">
            <BarChart3 size={23} />
          </span>
          reach<span className="brand-light">insight</span>
        </div>
        <div>
          <span className="eyebrow">BEYOND THE NUMBERS</span>
          <h1>
            その「いいね」は、
            <br />
            誰に届いた？
          </h1>
          <p>
            反応の数から、リーチの質へ。
            <br />
            PR投稿に集まる関心を、ひとつの画面で。
          </p>
          <div className="story-bars">
            {[45, 68, 52, 85, 62, 96, 73, 88, 61, 80, 96, 70].map((v, i) => (
              <i key={i} style={{ height: v + "%", opacity: 0.3 + i * 0.05 }} />
            ))}
          </div>
        </div>
        <small>INTERNAL ANALYTICS / INSTAGRAM MVP</small>
      </section>
      <section className="login-form">
        <form onSubmit={submit}>
          <span className="pill">
            <ShieldCheck size={14} /> 招待された方専用
          </span>
          <h2>ワークスペースへようこそ</h2>
          <p className="muted">
            招待されたメールアドレスとパスワードでログインしてください。
          </p>
          <label>
            メールアドレス
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            パスワード
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? <Loader2 className="spin" size={18} /> : null}ログイン
          </button>
          {demo && <div className="demo-help">
            <b>モックデモを試す</b>
            <p>
              パスワード：<code>local-demo</code>
              <br />
              外部APIへの接続や課金は発生しません。
            </p>
          </div>}
        </form>
      </section>
    </main>
  );
}
