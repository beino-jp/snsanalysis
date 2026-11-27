"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  BarChart3,
  LayoutDashboard,
  FolderOpen,
  Settings,
  ShieldCheck,
  Plus,
  Search,
  ChevronRight,
  ChevronLeft,
  Instagram,
  Users,
  Heart,
  MessageCircle,
  Activity,
  CheckCircle2,
  Clock,
  LogOut,
  X,
  Link2,
  Info,
  BookOpen,
  LockKeyhole,
  Loader2,
  Snowflake,
  RefreshCw,
  ExternalLink,
  Database,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { DEMO_URL } from "@/fixtures/demo";
import { Group, percent } from "@/domain/aggregation";
import AnalyzedUsers from "./analyzed-users";
import CampaignDiscovery from "./campaign-discovery";
import ValidationReports from "./validation-reports";
import type { AnalyzedUser } from "@/domain/analyzed-users";
type Estimate = {
  target: { owner: string; likes: number; comments: number; caption: string };
  cost: number | null;
  time: string;
  expectedLikes: number;
  expectedComments: number;
  limitation: string;
};
type Job = {
  id: string;
  project: string;
  status: string;
  progress: number;
  created_at: string;
  reference_at: string;
  cost: string;
  cost_unknown: boolean;
  error: string | null;
  target: {
    owner: string;
    postedAt: string;
    likes: number;
    comments: number;
    url: string;
  };
  settings: Record<string, any>;
  aggregates?: { like: Group; comment: Group; unique: Group };
  analyzedUsers?: AnalyzedUser[];
  highInterest?: {
    name: string;
    age: string;
    reason: string;
    confidence: number;
    links: { label: string; url: string | null }[];
  }[];
};
const statusLabels: Record<string, string> = {
  queued: "待機中",
  fetching: "取得中",
  analyzing: "判定中",
  completed: "完了",
  error: "エラー",
};
const date = (s: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(s));
const num = (v: number) => v.toLocaleString("ja-JP");
const yen = (j: Job) =>
  j.cost_unknown ? "一部未確定" : `$${Number(j.cost).toFixed(2)}`;
const genders = ["女性", "男性", "不明"];
const ages = ["10代", "20代", "30代", "40代", "50代", "60代以上", "不明"];
const colors = ["#5278e9", "#65bcb0", "#dce3ee"];
async function api<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const b = (await r.json()) as T & { error?: string };
  if (r.status === 401) {
    location.href = "/login";
    throw Error("認証が必要です");
  }
  if (!r.ok) throw Error(b.error ?? "通信に失敗しました");
  return b;
}
function Status({ job }: { job: Job }) {
  return (
    <div>
      <span className={"status " + job.status}>
        {job.status === "completed" ? (
          <CheckCircle2 size={12} />
        ) : job.status === "error" ? (
          <Info size={12} />
        ) : (
          <Clock size={12} />
        )}{" "}
        {statusLabels[job.status]}
      </span>
      {!["completed", "error"].includes(job.status) && (
        <div className="progress-track">
          <i style={{ width: job.progress + "%" }} />
        </div>
      )}
    </div>
  );
}
function Metric({
  title,
  value,
  foot,
  icon: Icon,
}: {
  title: string;
  value: string;
  foot: React.ReactNode;
  icon: typeof Users;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        {title}
        <span className="metric-icon">
          <Icon size={18} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">{foot}</div>
    </div>
  );
}
export default function Dashboard() {
  const [ready, setReady] = useState(false),
    [jobs, setJobs] = useState<Job[]>([]),
    [selected, setSelected] = useState<Job | null>(null),
    [page, setPage] = useState("overview"),
    [modal, setModal] = useState(false),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const list = await api<Job[]>("/api/jobs");
      setJobs(list);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void api("/api/session")
      .then(() => {
        setReady(true);
        void refresh();
      })
      .catch(() => {
        location.href = "/login";
      });
  }, [refresh]);
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      void refresh();
    }, 2500);
    return () => clearInterval(id);
  }, [ready, refresh]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    const load = () =>
      api<Job>("/api/jobs/" + selected.id)
        .then((j) => {
          if (active) setSelected(j);
        })
        .catch((e) => setError(e.message));
    void load();
    const id = setInterval(() => {
      if (selected.status !== "completed" && selected.status !== "error")
        void load();
    }, 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [selected?.id, selected?.status]);
  async function open(job: Job) {
    setError("");
    try {
      setSelected(await api<Job>("/api/jobs/" + job.id));
      setPage("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function navigate(p: string) {
    setSelected(null);
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (!ready)
    return (
      <main className="loading-screen">
        <Loader2 className="spin" size={28} />
      </main>
    );
  const total = jobs
      .filter((j) => j.status === "completed")
      .reduce((n, j) => n + (j.aggregates?.unique.total ?? 0), 0),
    completed = jobs.filter((j) => j.status === "completed").length,
    working = jobs.filter(
      (j) => !["completed", "error"].includes(j.status),
    ).length;
  const filtered = jobs.filter(
    (j) =>
      (filter === "all" || j.status === filter) &&
      (j.project + " " + j.target.owner)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const title =
    page === "live"
      ? "実データの取得記録"
      : page === "discovery"
        ? "目的から候補を探す"
        : page === "settings"
          ? "分析設定"
          : page === "privacy"
            ? "データとプライバシー"
            : page === "jobs"
              ? "案件・ジョブ一覧"
              : page === "result"
                ? "分析結果"
                : "ダッシュボード";
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-symbol">
            <BarChart3 size={23} />
          </span>
          <span className="brand-text">reach</span>
          <span className="brand-light">insight</span>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="メインナビゲーション">
          <button
            className={"nav-item " + (page === "overview" ? "active" : "")}
            onClick={() => navigate("overview")}
            title="ダッシュボード"
          >
            <LayoutDashboard size={19} />
            <span>ダッシュボード</span>
          </button>
          <button
            className={
              "nav-item " + (["jobs", "result"].includes(page) ? "active" : "")
            }
            onClick={() => navigate("jobs")}
            title="案件・ジョブ一覧"
          >
            <FolderOpen size={19} />
            <span>案件・ジョブ一覧</span>
            <span className="nav-count">{jobs.length}</span>
          </button>
          <button
            className={"nav-item " + (page === "discovery" ? "active" : "")}
            onClick={() => navigate("discovery")}
            title="候補を探す"
          >
            <Search size={19} />
            <span>候補を探す</span>
          </button>
          <button
            className={"nav-item " + (page === "live" ? "active" : "")}
            onClick={() => navigate("live")}
            title="実データの取得記録"
          >
            <Database size={19} />
            <span>実データの取得記録</span>
          </button>
          <button
            className={"nav-item " + (page === "settings" ? "active" : "")}
            onClick={() => navigate("settings")}
            title="分析設定"
          >
            <Settings size={19} />
            <span>分析設定</span>
          </button>
          <button
            className={"nav-item " + (page === "privacy" ? "active" : "")}
            onClick={() => navigate("privacy")}
            title="データとプライバシー"
          >
            <ShieldCheck size={19} />
            <span>データとプライバシー</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="user-row">
            <div className="user-avatar">RI</div>
            <div>
              デモワークスペース<small>社内メンバー</small>
            </div>
            <button
              title="ログアウト"
              className="icon-button"
              onClick={async () => {
                await api("/api/logout", {});
                location.href = "/login";
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
          <div className="sidebar-footer">
            <LockKeyhole size={12} /> INTERNAL USE ONLY
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            ワークスペース
            <ChevronRight size={13} />
            <b>{title}</b>
          </div>
          <div className="topbar-right">
            <span className="pill">
              <span>{page === "live" ? "取得記録" : "MOCK MODE"}</span>
            </span>
            <span className="small">Instagram MVP</span>
            <div className="user-avatar">RI</div>
            <button
              className="icon-button mobile-logout"
              aria-label="ログアウト"
              onClick={async () => {
                await api("/api/logout", {});
                location.href = "/login";
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <div className="content">
          {error && (
            <div className="error toast" role="alert">
              {error}
              <button onClick={() => void refresh()} className="text-link">
                {" "}
                再読み込み
              </button>
            </div>
          )}
          {page === "live" ? (
            <ValidationReports />
          ) : page === "discovery" ? (
            <CampaignDiscovery jobs={jobs} />
          ) : page === "result" && selected ? (
            <Result
              job={selected}
              onBack={() => navigate("jobs")}
              onRetry={async () => {
                await api("/api/jobs/" + selected.id + "/retry", {});
                setSelected(await api("/api/jobs/" + selected.id));
              }}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">REACH ANALYTICS</span>
                  <h1>{title}</h1>
                  <p className="muted">
                    {page === "settings"
                      ? "判定の基準を、チームで共有。"
                      : page === "privacy"
                        ? "個人のデータを守り、集計からインサイトを。"
                        : "PR投稿の反応を読み解き、リーチの質を見える化。"}
                  </p>
                </div>
                {!["settings", "privacy"].includes(page) && (
                  <button
                    className="btn primary"
                    onClick={() => setModal(true)}
                  >
                    <Plus size={18} />
                    新規分析
                  </button>
                )}
              </div>
              <div className="demo-banner">
                <Info size={18} style={{ flexShrink: 0 }} />
                <div>
                  <b>モックデータで体験中</b>
                  　架空のユーザー・投稿で、取得から属性分析までお試しいただけます。
                </div>
                <span>外部API・課金なし</span>
              </div>
              {["overview", "jobs"].includes(page) ? (
                <>
                  {page === "overview" && (
                    <div className="overview-metrics">
                      <Metric
                        title="分析ジョブ"
                        value={num(jobs.length)}
                        foot={
                          <>
                            {new Set(jobs.map((j) => j.project)).size}{" "}
                            案件のPR投稿
                          </>
                        }
                        icon={FolderOpen}
                      />
                      <Metric
                        title="取得ユーザー"
                        value={num(total)}
                        foot="完了ジョブ内のユニーク人数の合計"
                        icon={Users}
                      />
                      <Metric
                        title="分析完了"
                        value={num(completed)}
                        foot={
                          <>
                            <strong>
                              {jobs.length
                                ? Math.round((completed / jobs.length) * 100)
                                : 0}
                              %
                            </strong>{" "}
                            のジョブが完了
                          </>
                        }
                        icon={CheckCircle2}
                      />
                      <Metric
                        title="処理中のジョブ"
                        value={num(working)}
                        foot={
                          working
                            ? "バックグラウンドで分析しています"
                            : "新しい分析をはじめましょう"
                        }
                        icon={Activity}
                      />
                    </div>
                  )}
                  <section className="panel">
                    <div className="panel-header">
                      <div>
                        <h2>
                          {page === "overview"
                            ? "最近の分析ジョブ"
                            : "すべての分析ジョブ"}
                        </h2>
                        <p className="panel-subtitle">
                          案件ごとに、PR投稿の分析状況を確認できます
                        </p>
                      </div>
                      <button
                        className="icon-button"
                        title="再読み込み"
                        onClick={() => void refresh()}
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                    <div className="toolbar">
                      <div className="search">
                        <Search size={16} />
                        <input
                          aria-label="案件名・インフルエンサーで検索"
                          placeholder="案件名・インフルエンサーで検索"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </div>
                      <select
                        aria-label="ステータス"
                        className="select"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">すべてのステータス</option>
                        {Object.entries(statusLabels).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <span
                        className="muted small"
                        style={{ marginLeft: "auto" }}
                      >
                        Instagram
                      </span>
                    </div>
                    {filtered.length ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>案件 / PR投稿</th>
                              <th>インフルエンサー</th>
                              <th>ステータス</th>
                              <th>取得ユーザー</th>
                              <th>実行日</th>
                              <th>コスト</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((j) => (
                              <tr
                                key={j.id}
                                className="table-job"
                                onClick={() => void open(j)}
                              >
                                <td>
                                  <div className="post-cell">
                                    <span className="insta-icon">
                                      <Instagram size={18} />
                                    </span>
                                    <div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void open(j);
                                        }}
                                        style={{
                                          textAlign: "left",
                                          padding: 0,
                                        }}
                                      >
                                        <strong>{j.project}</strong>
                                      </button>
                                      <small>
                                        Instagram · {date(j.target.postedAt)}
                                      </small>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  @{j.target.owner}
                                  <small>PR投稿</small>
                                </td>
                                <td>
                                  <Status job={j} />
                                </td>
                                <td>
                                  {j.aggregates
                                    ? num(j.aggregates.unique.total)
                                    : "—"}
                                  <small>
                                    {j.aggregates
                                      ? "ユニーク"
                                      : "取得・判定後に表示"}
                                  </small>
                                </td>
                                <td>{date(j.created_at)}</td>
                                <td>
                                  {yen(j)}
                                  <small>モック</small>
                                </td>
                                <td>
                                  <ChevronRight size={16} className="chevron" />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty">
                        <div className="empty-icon">
                          <BarChart3 size={29} />
                        </div>
                        <h3>
                          {jobs.length
                            ? "条件に一致するジョブがありません"
                            : "最初のPR投稿を分析してみましょう"}
                        </h3>
                        <p>
                          {jobs.length
                            ? "検索条件を変更してください。"
                            : "投稿URLを登録すると、反応したユーザーの属性や関心を確認できます。"}
                        </p>
                        {!jobs.length && (
                          <button
                            className="btn primary"
                            onClick={() => setModal(true)}
                          >
                            <Plus size={16} />
                            デモ分析をはじめる
                          </button>
                        )}
                      </div>
                    )}
                    <div className="panel-footer">
                      <span>{filtered.length} 件のジョブ</span>
                      <span>2.5秒ごとに自動更新</span>
                    </div>
                  </section>
                  <div className="bottom-grid">
                    <section className="panel guide">
                      <h3>
                        <BookOpen size={18} className="guide-icon" />
                        数だけではわからない、反応の中身へ。
                      </h3>
                      <p>
                        性別・年代・関心から、PR投稿が届けたい層に届いているかを確認。
                        <br />
                        いいねとコメントを分けて、反応の違いも読み解けます。
                      </p>
                      <div className="guide-steps">
                        <div className="step">
                          <i>1</i>投稿URLを登録
                        </div>
                        <span className="step-line" />
                        <div className="step">
                          <i>2</i>取得・属性分析
                        </div>
                        <span className="step-line" />
                        <div className="step">
                          <i>3</i>結果を確認
                        </div>
                      </div>
                    </section>
                    <section className="privacy-card">
                      <h3>
                        <ShieldCheck size={19} />
                        プライバシーを大切に
                      </h3>
                      <p>
                        属性は公開情報に基づく推定です。
                        <br />
                        画像は保存せず、社外に共有するのは集計値のみ。
                        <br />
                        個人データは保存期限後に自動削除します。
                      </p>
                      <button
                        className="text-link"
                        style={{ marginTop: 12 }}
                        onClick={() => navigate("privacy")}
                      >
                        データの取り扱いを確認
                      </button>
                    </section>
                  </div>
                </>
              ) : page === "settings" ? (
                <SettingsView />
              ) : (
                <PrivacyView />
              )}
            </>
          )}
          <footer className="footer">
            <span>© 2026 Reach Insight</span>
            <span>推定属性は確定情報ではありません · INTERNAL USE ONLY</span>
          </footer>
        </div>
      </main>
      {modal && (
        <NewAnalysis
          onClose={() => setModal(false)}
          onCreated={async (id) => {
            setModal(false);
            await refresh();
            await open({ id } as Job);
          }}
        />
      )}
    </div>
  );
}
function NewAnalysis({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [url, setUrl] = useState(""),
    [project, setProject] = useState(""),
    [reference, setReference] = useState("execution"),
    [estimate, setEstimate] = useState<Estimate | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) closeRef.current();
      if (e.key === "Tab") {
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".modal button:not(:disabled), .modal input:not(:disabled), .modal select:not(:disabled), .modal a[href]",
          ),
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", h);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = old;
      before?.focus();
    };
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!estimate)
        setEstimate(
          await api<Estimate>("/api/estimate", { url, project: project.trim() || "投稿の分析", reference }),
        );
      else {
        const result = await api<{ id: string }>("/api/jobs", {
          url,
          project: project.trim() || "投稿の分析",
          reference,
        });
        onCreated(result.id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-title"
      >
        <form onSubmit={submit}>
          <div className="modal-header">
            <div>
              <span className="eyebrow">NEW ANALYSIS</span>
              <h2 id="new-title">
                {estimate ? "実行前の確認" : "新しいPR投稿を分析"}
              </h2>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="閉じる"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
          <div className="modal-body">
            <ol className="registration-steps" aria-label="分析の手順">
              <li className={!estimate ? "current" : "done"}>
                <span>1</span>投稿を登録
              </li>
              <li className={estimate ? "current" : ""}>
                <span>2</span>見積もりを確認
              </li>
              <li>
                <span>3</span>分析開始
              </li>
            </ol>
            {!estimate ? (
              <>
                <p className="modal-description">
                  Instagramの公開投稿・リールのURLを登録してください。
                </p>
                <label>
                  Instagram投稿のURL
                  <button
                    className="sample-button"
                    type="button"
                    onClick={() => setUrl(DEMO_URL)}
                  >
                    デモURLを使う
                  </button>
                  <input
                    type="url"
                    autoFocus
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.instagram.com/p/.../"
                  />
                </label>
                <details style={{margin:"18px 0"}}>
                  <summary style={{cursor:"pointer"}}>案件名・詳細設定（任意）</summary>
                  <label>案件名<input maxLength={100} value={project} onChange={e=>setProject(e.target.value)} placeholder="例：冬の新商品PR（空欄でも進めます）" /></label>
                <label>
                  分析の基準日
                  <select
                    className="select"
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: 7,
                      padding: 12,
                    }}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  >
                    <option value="execution">分析を実行した日</option>
                    <option value="post">PR投稿の投稿日</option>
                  </select>
                  <div className="form-hint">
                    基準日時から過去365日以内の投稿を分析します。
                  </div>
                </label>
                </details>
                <div className="demo-banner" style={{ marginBottom: 0 }}>
                  <Database size={18} />
                  <div>
                    モックモードでは、入力URLに架空データを紐づけます。実際の投稿は取得しません。
                  </div>
                </div>
              </>
            ) : (
              <>
                <span className="pill">
                  <Instagram size={14} /> Instagram
                </span>
                <h3 style={{ marginTop: 14 }}>{project.trim() || "投稿の分析"}</h3>
                <p className="muted small">@{estimate.target.owner}</p>
                <div className="estimate-grid">
                  <div className="estimate-cell">
                    表示いいね数<b>{num(estimate.target.likes)}</b>取得見込み：
                    {estimate.expectedLikes}人
                  </div>
                  <div className="estimate-cell">
                    表示コメント数<b>{num(estimate.target.comments)}</b>
                    取得見込み：{estimate.expectedComments}件（本人除外前）
                  </div>
                  <div className="estimate-cell">
                    推定コスト<b>$0.00</b>モックデータのため無料
                  </div>
                  <div className="estimate-cell">
                    推定処理時間<b>{estimate.time}</b>バックグラウンドで処理
                  </div>
                </div>
                <p className="form-hint">{estimate.limitation}</p>
                <div className="section-info">
                  <ShieldCheck size={16} />
                  鍵アカはスキップし、画像は保存しません。
                </div>
              </>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => (estimate ? setEstimate(null) : onClose())}
            >
              {estimate ? "入力に戻る" : "キャンセル"}
            </button>
            <button className="btn primary" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : estimate ? (
                <Activity size={16} />
              ) : (
                <Search size={16} />
              )}{" "}
              {estimate ? "分析を実行" : "見積もりを確認"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function Result({
  job,
  onBack,
  onRetry,
}: {
  job: Job;
  onBack: () => void;
  onRetry: () => void;
}) {
  const [tab, setTab] = useState<"like" | "comment" | "unique">("like"),
    [base, setBase] = useState("public");
  const g = job.aggregates?.[tab],
    den = g ? (base === "public" ? g.analyzed : g.total) : 0;
  const [view, setView] = useState<"summary" | "users">("summary");
  const [initialSkate, setInitialSkate] = useState("all");
  const [retrying, setRetrying] = useState(false);
  return (
    <>
      <button className="back-button" onClick={onBack}>
        <ChevronLeft size={15} />
        案件・ジョブ一覧に戻る
      </button>
      <div className="page-heading">
        <div className="result-header">
          <span className="insta-icon">
            <Instagram size={26} />
          </span>
          <div>
            <span className="eyebrow">ANALYSIS REPORT</span>
            <h1>{job.project}</h1>
            <div className="result-meta">
              <span>@{job.target.owner}</span>
              <span>投稿：{date(job.target.postedAt)}</span>
              <span>実行：{date(job.created_at)}</span>
            </div>
          </div>
        </div>
        <Status job={job} />
      </div>
      <div className="demo-banner">
        <Info size={18} />
        <div>
          <b>モック分析レポート</b>
          　表示される属性・投稿・画像判定は、すべて架空データです。
        </div>
        <span>集計基準日 {date(job.reference_at)}</span>
      </div>
      {!g ? (
        <section className="panel processing">
          {job.status === "error" ? (
            <>
              <Info size={36} style={{ margin: "auto", color: "#ba554a" }} />
              <h2>分析を一時停止しました</h2>
              <p>{job.error}</p>
              <button
                className="btn primary"
                style={{ marginTop: 24 }}
                disabled={retrying}
                onClick={async () => {
                  setRetrying(true);
                  try {
                    await onRetry();
                  } finally {
                    setRetrying(false);
                  }
                }}
              >
                <RefreshCw size={16} />
                保存済みの地点から再開
              </button>
            </>
          ) : (
            <>
              <Loader2
                className="spin"
                size={36}
                style={{ margin: "auto", color: "#5278e9" }}
              />
              <h2>
                {job.status === "queued"
                  ? "分析を準備しています"
                  : job.status === "fetching"
                    ? "いいね・コメントを取得しています"
                    : "公開アカウントの属性を分析しています"}
              </h2>
              <p>この画面を離れても、処理はバックグラウンドで続きます。</p>
              <div className="progress-track">
                <i style={{ width: job.progress + "%" }} />
              </div>
              <span className="muted small">
                {job.progress}% 完了 · 自動更新中
              </span>
              <div
                className="section-info"
                style={{ justifyContent: "center" }}
              >
                鍵アカの投稿は取得しません。公開投稿のみが判定対象です。
              </div>
            </>
          )}
        </section>
      ) : (
        <>
          <nav className="report-nav" aria-label="分析結果の表示">
            <button
              className={view === "summary" ? "active" : ""}
              aria-pressed={view === "summary"}
              onClick={() => setView("summary")}
            >
              <BarChart3 size={18} />
              集計レポート
            </button>
            <button
              className={view === "users" ? "active" : ""}
              aria-pressed={view === "users"}
              onClick={() => {
                setInitialSkate("all");
                setView("users");
              }}
            >
              <Users size={18} />
              ユーザー一覧<span>{g.analyzed}</span>
            </button>
            <span className="report-nav-note">
              {view === "summary"
                ? "全体の傾向を把握"
                : "一人ずつ判定の根拠を確認"}
            </span>
          </nav>
          <div className="tabs" role="tablist" aria-label="反応の種類">
            {(
              [
                ["like", "いいね"],
                ["comment", "コメント"],
                ["unique", "合計（ユニーク）"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                id={`reaction-tab-${key}`}
                aria-controls="reaction-content"
                tabIndex={tab === key ? 0 : -1}
                aria-selected={tab === key}
                onKeyDown={(e) => {
                  const keys = ["like", "comment", "unique"] as const;
                  const index = keys.indexOf(key);
                  const next =
                    e.key === "ArrowRight"
                      ? (index + 1) % 3
                      : e.key === "ArrowLeft"
                        ? (index + 2) % 3
                        : e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? 2
                            : null;
                  if (next !== null) {
                    e.preventDefault();
                    setTab(keys[next]);
                    (
                      e.currentTarget.parentElement?.querySelectorAll("button")[
                        next
                      ] as HTMLButtonElement
                    )?.focus();
                  }
                }}
                className={tab === key ? "selected" : ""}
                onClick={() => setTab(key)}
              >
                {label}
                <span>{job.aggregates![key].total}</span>
              </button>
            ))}
          </div>
          <section
            id="reaction-content"
            role="tabpanel"
            aria-labelledby={`reaction-tab-${tab}`}
          >
            <div className="results-controls">
              <span>
                {tab === "comment"
                  ? `取得コメント ${g.records}件 / 表示 ${g.displayed}件`
                  : tab === "unique"
                    ? "いいね・コメント間の重複を除外"
                    : `取得いいね ${g.total}人 / 表示 ${g.displayed}件`}
                {g.acquisition !== null &&
                  ` · 取得率 ${percent(g.acquisition, 1)}%`}
              </span>
              <label>
                割合の分母
                <select
                  className="select"
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                >
                  <option value="public">分析済み公開アカウント</option>
                  <option value="all">全取得ユーザー</option>
                </select>
              </label>
            </div>
            {view === "summary" && (
              <>
                <div className="overview-metrics">
                  <Metric
                    title="取得ユーザー"
                    value={num(g.total)}
                    foot={
                      tab === "unique"
                        ? "全反応のユニーク人数"
                        : "区分内の重複を除いた人数"
                    }
                    icon={Users}
                  />
                  <Metric
                    title="分析済み公開アカウント"
                    value={num(g.analyzed)}
                    foot={
                      <>
                        属性集計の分母 ·{" "}
                        <strong>{percent(g.analyzed, g.total)}%</strong>
                      </>
                    }
                    icon={CheckCircle2}
                  />
                  <Metric
                    title="鍵アカウント"
                    value={num(g.private)}
                    foot="属性判定をスキップ"
                    icon={LockKeyhole}
                  />
                  <Metric
                    title="スケート高関心"
                    value={num(g.highInterest)}
                    foot={
                      <>
                        体験の確度高 ·{" "}
                        <strong>{percent(g.highInterest, den)}%</strong>
                      </>
                    }
                    icon={Snowflake}
                  />
                </div>
                <div className="report-shortcuts">
                  <div>
                    <Users size={19} />
                    <span>集計の内訳を確認</span>
                    <b>{g.analyzed}人を分析済み</b>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        setInitialSkate("all");
                        setView("users");
                      }}
                    >
                      ユーザー一覧を見る
                      <ChevronRight size={15} />
                    </button>
                    <button
                      onClick={() => {
                        setInitialSkate("行った（確度高）");
                        setView("users");
                      }}
                    >
                      高関心の{g.highInterest}人を見る
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
                <div className="charts-grid">
                  <section className="panel chart-panel">
                    <div className="chart-title">
                      <h2>性別</h2>
                      <small>GENDER</small>
                    </div>
                    <div className="gender-chart">
                      <div style={{ width: "55%", height: 190, minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={genders.map((name) => ({
                                name,
                                value: g.gender[name] ?? 0,
                              }))}
                              dataKey="value"
                              innerRadius={57}
                              outerRadius={79}
                              paddingAngle={3}
                              stroke="none"
                              isAnimationActive={false}
                            >
                              {colors.map((c) => (
                                <Cell fill={c} key={c} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => `${v}人`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="legend">
                        {genders.map((name, i) => (
                          <p key={name}>
                            <i style={{ background: colors[i] }} />
                            {name}
                            <b>{percent(g.gender[name] ?? 0, den)}%</b>
                          </p>
                        ))}
                      </div>
                    </div>
                    <p className="chart-note">
                      {genders
                        .map((name) => `${name} ${g.gender[name] ?? 0}人`)
                        .join(" / ")}
                    </p>
                  </section>
                  <section className="panel chart-panel">
                    <div className="chart-title">
                      <h2>年代</h2>
                      <small>AGE DISTRIBUTION</small>
                    </div>
                    <div style={{ height: 200, marginTop: 20 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={ages.map((name) => ({
                            name,
                            value: g.age[name] ?? 0,
                          }))}
                          margin={{ top: 12, left: -30, right: 0, bottom: 0 }}
                        >
                          <CartesianGrid vertical={false} stroke="#edf0f5" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: "#8190a2" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: "#8190a2" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip formatter={(v) => `${v}人`} />
                          <Bar
                            dataKey="value"
                            name="人数"
                            fill="#7291e9"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={32}
                            isAnimationActive={false}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="chart-note">
                      {ages
                        .map((name) => `${name} ${g.age[name] ?? 0}人`)
                        .join(" / ")}
                    </p>
                  </section>
                  <section className="panel chart-panel">
                    <div className="chart-title">
                      <h2>関心・ライフステージ</h2>
                      <small>INTERESTS</small>
                    </div>
                    <div className="horizontal-bars">
                      {["カップル", "子持ち", "スケート関心", "犬好き"].map(
                        (name, i) => (
                          <div key={name} className="bar-row">
                            <span className="bar-label">{name}</span>
                            <div className="bar-track">
                              <div
                                className="bar-fill"
                                style={{
                                  background: [
                                    "#6d8dec",
                                    "#7bbdb4",
                                    "#6ba7ce",
                                    "#a39bd0",
                                  ][i],
                                  width:
                                    percent(g.interests[name] ?? 0, den) + "%",
                                }}
                              />
                            </div>
                            <span className="bar-value">
                              {g.interests[name] ?? 0}人{" "}
                              <span className="muted">
                                {percent(g.interests[name] ?? 0, den)}%
                              </span>
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                    <p className="chart-note">
                      複数該当あり。割合の合計が100%を超える場合があります。
                    </p>
                  </section>
                  <section className="panel chart-panel">
                    <div className="chart-title">
                      <h2>アイススケート判定</h2>
                      <small>SKATING INTEREST</small>
                    </div>
                    <div className="horizontal-bars">
                      {[
                        "行った（確度高）",
                        "可能性あり",
                        "観戦",
                        "該当なし",
                      ].map((name, i) => (
                        <div key={name} className="bar-row">
                          <span className="bar-label">{name}</span>
                          <div className="bar-track">
                            <div
                              className="bar-fill"
                              style={{
                                background: [
                                  "#55aa9c",
                                  "#8abdb5",
                                  "#8ba9d7",
                                  "#d7e0eb",
                                ][i],
                                width: percent(g.skate[name] ?? 0, den) + "%",
                              }}
                            />
                          </div>
                          <span className="bar-value">
                            {g.skate[name] ?? 0}人{" "}
                            <span className="muted">
                              {percent(g.skate[name] ?? 0, den)}%
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="chart-note">
                      観戦は体験と区別。スケボー・ローラー・期間外の投稿は対象外。
                    </p>
                  </section>
                </div>
                <section className="panel cross-panel">
                  <div className="panel-header">
                    <h2>性別 × 年代</h2>
                    <span className="muted small">クロス集計 / 人数</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>性別</th>
                          {ages.map((age) => (
                            <th key={age}>{age}</th>
                          ))}
                          <th>合計</th>
                        </tr>
                      </thead>
                      <tbody>
                        {genders.map((gender) => (
                          <tr key={gender}>
                            <td>{gender}</td>
                            {ages.map((age) => (
                              <td key={age}>
                                <span
                                  className={
                                    (g.cross[`${gender}・${age}`] ?? 0) > 0
                                      ? "cross-cell"
                                      : ""
                                  }
                                >
                                  {g.cross[`${gender}・${age}`] ?? 0}
                                </span>
                              </td>
                            ))}
                            <td>
                              <b>{g.gender[gender] ?? 0}</b>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
            {view === "users" && (
              <AnalyzedUsers
                key={initialSkate}
                users={job.analyzedUsers ?? []}
                channel={tab}
                initialSkate={initialSkate}
              />
            )}
            <div className="section-info">
              <Info size={15} />
              現在の割合の分母：
              {base === "public"
                ? "分析済み公開アカウント"
                : "全取得ユーザー"}{" "}
              {den}人。不明を含む。判定失敗 {g.failed}人。
            </div>
            <div className="section-info" style={{ paddingTop: 0 }}>
              ユニーク全体の表示人数は取得できないため、ユニーク取得率は算出しません。コメント取得率は本人除外後のコメント件数で計算。
            </div>
          </section>
        </>
      )}
    </>
  );
}
function SettingsView() {
  return (
    <section className="panel info-panel">
      <div className="chart-title">
        <h2>Instagram MVPの判定設定</h2>
        <span className="read-only-tag">P1：参照のみ</span>
      </div>
      <p>実行時の設定は各ジョブに保存されます。編集画面はP2で追加します。</p>
      <div className="table-wrap">
        <table>
          <tbody>
            {[
              ["対象期間", "基準日時から過去365日（境界を含む）"],
              [
                "スケートの点数",
                "施設名 +3 / ハッシュタグ +2 / 文章 +2 / 体験語 +1 / 画像確認 +3",
              ],
              ["体験の確度高", "1投稿5点以上、かつAI判定 went"],
              [
                "可能性あり",
                "2〜4点またはAI判定 maybe。AIの no と除外ルールを優先",
              ],
              ["除外・区別", "スケボー・ローラーは除外、観戦は別枠"],
              ["属性の確信度", "0.6未満は不明"],
              [
                "判定キャッシュ",
                "30日以内かつ基準日・設定・モデル・プロンプト版が一致",
              ],
              ["画像のみの投稿を判定", "OFF"],
              ["Provider", "MockDataProvider / MockLLMProvider"],
              ["プロンプト版", "2026-11-21.1"],
            ].map(([k, v]) => (
              <tr key={k}>
                <td>
                  <strong>{k}</strong>
                </td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <LockKeyhole size={14} style={{ display: "inline", marginRight: 6 }} />
        APIキーはサーバーの環境変数で管理します。
      </p>
    </section>
  );
}
function PrivacyView() {
  return (
    <section className="panel info-panel">
      <h2>データを扱うためのルール</h2>
      <p>
        本デモは架空データのみを使用します。実データへの接続は、P0検証と運用条件の確認後に有効化します。
      </p>
      <ul>
        <li>画像・動画・サムネイルは永続保存しません。</li>
        <li>鍵アカウントの投稿は取得・分析しません。</li>
        <li>
          生データ・明細は初期値90日で自動削除します。ワーカーの稼働が必要です。
        </li>
        <li>
          10代と推定したユーザーの氏名・ユーザー名・投稿リンクは伏せます。
        </li>
        <li>健康・宗教・政治などの配慮が必要な属性は推定しません。</li>
        <li>
          個別の判定結果は社内確認用です。社外向けの出力は集計値に限定します。
        </li>
        <li>属性は推定です。不明を含めて表示し、確定情報として扱いません。</li>
      </ul>
      <p>
        CSV・PDFの出力機能はP2対象です。現在、個人明細のエクスポート機能はありません。
      </p>
    </section>
  );
}
