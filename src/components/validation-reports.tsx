"use client";
import { useEffect, useState } from "react";
import {
  Database,
  Upload,
  Info,
  ExternalLink,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import {audienceCounts} from "@/domain/audience";
import type { ValidationReport } from "@/domain/validation-report";
type Entry = { id: string; payload: ValidationReport; created_at: string };
const number = (n: number) => n.toLocaleString("ja-JP");
export default function ValidationReports() {
  const [rows, setRows] = useState<Entry[]>([]),
    [url, setUrl] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState("");
  async function load() {
    const r = await fetch("/api/validation-reports", { cache: "no-store" }),
      data = await r.json();
    if (!r.ok) throw Error(data.error);
    setRows(data);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 262144)
        throw Error("JSONファイルは256KB以下にしてください");
      const journal = JSON.parse(await file.text());
      const r = await fetch("/api/validation-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, journal }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      await load();
      setSelected(data.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const entry = rows.find((r) => r.id === selected) ?? rows[0],
    report = entry?.payload;
  return (
    <div className="validation-page">
      <div className="page-heading">
        <div>
          <h1>実データの取得記録</h1>
          <p className="muted">
            Macで実行した少量取得テストの結果を表示します。
          </p>
        </div>
        <span className="pill">
          <Database size={15} />
          検証記録
        </span>
      </div>
      <div className="demo-banner">
        <Info size={18} />
        <div>
          ここではモックの属性・ユーザーを混ぜません。ローカルに保存した取得記録を読み込み、再取得・API課金は行いません。
        </div>
      </div>
      <form className="panel validation-import" onSubmit={upload}>
        <h2>
          <Upload size={18} />
          検証JSONを取り込む
        </h2>
        <p className="form-hint">
          対象はアプリ内の .p0-results/probe-投稿ID.json
          です。明細保存を指定した新しいテストでは、コメント本文とユーザー名も取り込めます。
        </p>
        <label>
          検証したInstagram投稿URL
          <input
            required
            type="url"
            placeholder="https://www.instagram.com/p/.../"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label>
          検証JSONファイル
          <input
            required
            type="file"
            accept=".json,application/json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary" disabled={!file || busy}>
          {busy ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
          記録をUIに表示
        </button>
      </form>
      {report ? (
        <>
          <div className="validation-selection">
            <label>
              表示する取得記録
              <select
                className="select"
                value={entry.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.payload.startedAt).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                    })}{" "}
                    · {r.payload.url.split("/")[4]}
                  </option>
                ))}
              </select>
            </label>
            <a href={report.url} target="_blank" rel="noopener noreferrer">
              投稿を開く
              <ExternalLink size={14} />
            </a>
          </div>
          <div className="overview-metrics">
            {[
              [
                "表示いいね数",
                number(report.displayedLikes),
                "いいねユーザー一覧は未取得",
              ],
              [
                "表示コメント数",
                number(report.displayedComments),
                "取得時点の投稿の表示件数",
              ],
              [
                "取得コメント",
                number(report.commentRecords),
                `ユニーク ${number(report.uniqueCommenters)}人`,
              ],
              [
                "コメント取得率",
                report.commentAcquisition === null
                  ? "算出不可"
                  : (report.commentAcquisition * 100).toFixed(1) + "%",
                "取得件数 ÷ 表示コメント数",
              ],
            ].map(([title, value, foot]) => (
              <section className="metric" key={title}>
                <div className="metric-top">{title}</div>
                <div className="metric-value">{value}</div>
                <p className="metric-foot">{foot}</p>
              </section>
            ))}
          </div>
          {report.audience && <section className="panel validation-details">
            <h2>どんな層に届いたか</h2>
            <p>分析対象 {report.audience.people.length}人／コメント取得者 {report.uniqueCommenters}人。投稿全体・いいねユーザー全体を代表する調査ではありません。</p>
            <h3>性別・年代</h3>
            {(['gender','age'] as const).map(field=><p key={field}>{field==='gender'?'性別':'年代'}：{Object.entries(audienceCounts(report.audience!.people,field)).map(([k,n])=>`${k} ${n}人`).join(' ／ ')}</p>)}
            <h3>関心・どんな人か</h3>
            {report.audience.people.map((p,i)=><article key={i} style={{padding:"16px 0",borderBottom:"1px solid #e2e8f0"}}>
              <strong>対象者 {i+1} · {p.gender.value}／{p.age.value}</strong>
              <p>{p.description}</p>
              <p className="form-hint">性別の根拠：{p.gender.reason} ／ 年代の根拠：{p.age.reason}</p>
              {p.interests.map((f,j)=><p key={j}><strong>{f.value}</strong>（確信度 {Math.round(f.confidence*100)}%） · {f.reason}<br/>根拠：「{f.evidence.join('」「')}」</p>)}
              {p.age.value!=='10代' && <a href={`https://www.instagram.com/${p.username}/`} target="_blank" rel="noopener noreferrer">プロフィールで確認 ↗</a>}
            </article>)}
            <p className="form-hint">自己紹介・取得できた公開投稿テキストに基づく推定です。非公開・根拠不足は不明。名前や見た目で性別・年代を補いません。</p>
          </section>}
          {!report.audience && report.comments && <section className="panel validation-details">
            <h2>取得したコメント</h2>
            <p className="form-hint">公開コメントの原文です。属性・選定理由のAI判定は未実施です。リンク先はInstagramです。</p>
            {report.comments.map((c, i) => <article key={i} style={{borderBottom:"1px solid #e2e8f0",padding:"16px 0"}}>
              {c.profileUrl ? <a href={c.profileUrl} target="_blank" rel="noopener noreferrer">@{c.username} ↗</a> : <strong>ユーザー名未取得</strong>}
              <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{c.text}</p>
              <span className="muted">属性・選定理由：未判定</span>
            </article>)}
          </section>}
          <section className="panel validation-details">
            <h2>取得・保存の状況</h2>
            <dl>
              <dt>検証実行日（日本時間）</dt>
              <dd>
                {new Date(report.startedAt).toLocaleString("ja-JP", {
                  timeZone: "Asia/Tokyo",
                })}
              </dd>
              <dt>投稿・コメント取得の利用料</dt>
              <dd>
                ${report.costUsd.toFixed(4)}（プロフィール取得・AI分析費は含みません。最終請求は各サービスで確認）
              </dd>
              <dt>外部保存先</dt>
              <dd>
                <ShieldCheck size={15} />
                検証プログラムの記録：削除済み
              </dd>
              <dt>属性判定</dt>
              <dd>未実施 — 性別・年代・関心を推測で補いません</dd>
              <dt>コメント本文・ユーザー明細</dt>
              <dd>{report.comments ? `${report.comments.length}件を保存。プロフィール詳細・属性は未取得です` : "以前のテストでは保存せず削除したため、ここにはありません"}</dd>
            </dl>
            <p className="error">
              これは一部取得の検証結果です。返信は取得対象外です。投稿者本人の除外と属性判定は未実施のため、属性集計用の人数とは異なります。
            </p>
            <p className="form-hint">
              出所：利用者がアップロードしたローカル検証記録。サーバーがApifyへ再照合した結果ではありません。投稿URLとファイルの対応を確認してください。
            </p>
          </section>
        </>
      ) : (
        <section className="panel empty">
          <Database size={30} style={{ margin: "0 auto 15px" }} />
          <h3>検証記録を読み込んでください</h3>
          <p>実際の記録を選ぶまで、数値や属性は表示しません。</p>
        </section>
      )}
    </div>
  );
}
