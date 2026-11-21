"use client";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  Sparkles,
  ShieldCheck,
  Info,
  ChevronRight,
  ChevronLeft,
  Loader2,
  ExternalLink,
  SlidersHorizontal,
  CheckCircle2,
  Target,
  Users,
  Wallet,
  RefreshCw,
  X,
} from "lucide-react";
import type {
  Goal,
  Plan,
  Planning,
  Recommendation,
} from "@/domain/campaign/types";
import type { scoreReach } from "@/domain/campaign/scoring";
type SearchJob = {
  id: string;
  status: string;
  plan: Plan;
  provider: string;
  budget_yen: number;
  spent_yen: number;
  reserved_yen: number;
  progress: number;
  created_at: string;
  error: string | null;
  recommendations?: Recommendation[];
  report?: {
    recommendations: Recommendation[];
    reach:
      | (ReturnType<typeof scoreReach> & {
          referenceOnly: boolean;
          acquisition: { like: number | null; comment: number | null };
        })
      | null;
    searched: number;
    analyzed: number;
    excluded: number;
    notice: string;
  };
};
type SourceJob = { id: string; project: string; status: string };
const money = (n: number) => n.toLocaleString("ja-JP") + "円";
const pc = (n: number) => `${Math.round(n * 100)}%`;
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
  const data = await r.json();
  if (r.status === 401) {
    location.href = "/login";
    throw Error("認証が必要です");
  }
  if (!r.ok) throw Error(data.error ?? "処理に失敗しました");
  return data;
}
const emptyGoal: Goal = {
  purpose: "",
  audience: "",
  region: "",
  topic: "",
  targetTags: [],
  ages: [],
  sourceJobId: null,
};
export default function CampaignDiscovery({ jobs }: { jobs: SourceJob[] }) {
  const [goal, setGoal] = useState<Goal>(emptyGoal),
    [questions, setQuestions] = useState<Planning["questions"]>([]),
    [plan, setPlan] = useState<Plan | null>(null),
    [stage, setStage] = useState<"goal" | "confirm" | "result">("goal"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [current, setCurrent] = useState<SearchJob | null>(null),
    [history, setHistory] = useState<SearchJob[]>([]);
  const loadHistory = async () => {
    try {
      setHistory(await api<SearchJob[]>("/api/campaigns"));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void loadHistory();
  }, []);
  useEffect(() => {
    if (
      !current ||
      ["completed", "error", "budget_stopped"].includes(current.status)
    )
      return;
    const t = setInterval(() => {
      void api<SearchJob>("/api/campaigns/" + current.id)
        .then((j) => {
          setCurrent(j);
          if (["completed", "error", "budget_stopped"].includes(j.status))
            void loadHistory();
        })
        .catch((e) => setError(e.message));
    }, 1500);
    return () => clearInterval(t);
  }, [current?.id, current?.status]);
  async function propose(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<Planning>("/api/campaigns/plan", goal);
      setQuestions(r.questions);
      if (r.plan) {
        setPlan(r.plan);
        setGoal(r.plan.goal);
        setStage("confirm");
      } else
        document
          .getElementById("goal-questions")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ id: string }>("/api/campaigns", plan);
      setCurrent(await api<SearchJob>("/api/campaigns/" + r.id));
      setStage("result");
      void loadHistory();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    setError("");
    try {
      setCurrent(await api<SearchJob>("/api/campaigns/" + id));
      setStage("result");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function fresh() {
    setStage("goal");
    setCurrent(null);
    setPlan(null);
    setQuestions([]);
    setError("");
  }
  const totalWeight = plan?.criteria.reduce((n, c) => n + c.weight, 0) ?? 0;
  return (
    <div className="campaign-page">
      <div className="page-heading">
        <div>
          <h1>目的から候補を探す</h1>
          <p className="muted">
            案件の目的を評価基準にして、合いそうなインフルエンサーを最大10人推薦。
          </p>
        </div>
        {stage === "result" && (
          <button className="btn primary" onClick={fresh}>
            <Search size={17} />
            新しい検索
          </button>
        )}
      </div>
      <div className="discovery-budget">
        <div>
          <Wallet size={20} />
          <span>
            1回の予算上限<b>3,000円</b>
          </span>
        </div>
        <p>約100アカウント・各20投稿まで / 推薦は最大10人</p>
        <span className="pill">デモは0円</span>
      </div>
      <div className="demo-banner">
        <Info size={18} />
        <div>
          <b>モックデータで体験中</b>
          　架空の候補を評価します。Instagramの取得・OpenAIへの送信・課金は行いません。
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {stage !== "result" && (
        <ol className="campaign-steps">
          <li className={stage === "goal" ? "current" : "done"}>
            <span>1</span>目的と条件
          </li>
          <li className={stage === "confirm" ? "current" : ""}>
            <span>2</span>評価基準を確認
          </li>
          <li>
            <span>3</span>結果・推薦を見る
          </li>
        </ol>
      )}
      {stage === "goal" ? (
        <div className="campaign-layout">
          <form className="panel campaign-form" onSubmit={propose}>
            <h2>
              <Target size={20} />
              この案件で実現したいこと
            </h2>
            <p className="muted small">
              自由に入力してください。足りない条件があれば、補足をお聞きします。
            </p>
            <label htmlFor="campaign-purpose">案件の目的</label>
            <textarea
              id="campaign-purpose"
              required
              minLength={5}
              maxLength={1500}
              value={goal.purpose}
              onChange={(e) => setGoal({ ...goal, purpose: e.target.value })}
              placeholder="例：銀座のアイススケートに、都内の20〜30代のカップルや子連れを集客したい。"
            />
            <button
              type="button"
              className="text-link"
              onClick={() =>
                setGoal({
                  ...emptyGoal,
                  purpose:
                    "銀座のアイススケートに、都内の20〜30代のカップルや子連れを集客したい。",
                  ages: ["20代", "30代"],
                  targetTags: ["カップル", "子持ち"],
                })
              }
            >
              スケート案件の入力例を使う
            </button>
            {questions.length > 0 && (
              <div className="goal-questions" id="goal-questions">
                <h3>もう少し教えてください</h3>
                {questions.map((q) => (
                  <p key={q.field}>
                    <Info size={15} />
                    {q.text}
                  </p>
                ))}
              </div>
            )}
            <div className="goal-fields">
              <label>
                最も重視する成果
                <select
                  className="select"
                  value={goal.objective ?? ""}
                  onChange={(e) =>
                    setGoal({
                      ...goal,
                      objective: (e.target.value ||
                        undefined) as Goal["objective"],
                    })
                  }
                >
                  <option value="">目的の文章から判断する</option>
                  <option value="awareness">認知を広げる</option>
                  <option value="visits">来場・来店につなげる</option>
                  <option value="sales">購入につなげる</option>
                </select>
              </label>
              <label>
                届けたい人
                <input
                  value={goal.audience}
                  onChange={(e) =>
                    setGoal({ ...goal, audience: e.target.value })
                  }
                  placeholder="例：カップル、子育て世帯"
                  maxLength={200}
                />
              </label>
              <label>
                対象エリア
                <input
                  value={goal.region}
                  onChange={(e) => setGoal({ ...goal, region: e.target.value })}
                  placeholder="例：東京、大阪、全国"
                  maxLength={80}
                />
              </label>
              <label>
                商品・体験のジャンル
                <input
                  value={goal.topic}
                  onChange={(e) => setGoal({ ...goal, topic: e.target.value })}
                  placeholder="例：スケート、グルメ"
                  maxLength={100}
                />
              </label>
            </div>
            <fieldset className="goal-checks">
              <legend>特に届けたい層（任意）</legend>
              {(["カップル", "子持ち", "犬好き"] as const).map((t) => (
                <label key={t}>
                  <input
                    type="checkbox"
                    checked={goal.targetTags.includes(t)}
                    onChange={(e) =>
                      setGoal({
                        ...goal,
                        targetTags: e.target.checked
                          ? [...goal.targetTags, t]
                          : goal.targetTags.filter((v) => v !== t),
                      })
                    }
                  />
                  {t}
                </label>
              ))}
            </fieldset>
            <fieldset className="goal-checks">
              <legend>対象年代（任意）</legend>
              {(["20代", "30代", "40代", "50代", "60代以上"] as const).map(
                (t) => (
                  <label key={t}>
                    <input
                      type="checkbox"
                      checked={goal.ages.includes(t)}
                      onChange={(e) =>
                        setGoal({
                          ...goal,
                          ages: e.target.checked
                            ? [...goal.ages, t]
                            : goal.ages.filter((v) => v !== t),
                        })
                      }
                    />
                    {t}
                  </label>
                ),
              )}
            </fieldset>
            <label>
              あわせて目的スコアを出すPR投稿（任意）
              <select
                className="select"
                value={goal.sourceJobId ?? ""}
                onChange={(e) =>
                  setGoal({ ...goal, sourceJobId: e.target.value || null })
                }
              >
                <option value="">候補探しのみ</option>
                {jobs
                  .filter((j) => j.status === "completed")
                  .map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.project} · {j.id.slice(0, 6)}
                    </option>
                  ))}
              </select>
            </label>
            <button className="btn primary" disabled={busy}>
              {busy ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Sparkles size={16} />
              )}
              目的と評価基準を整理
            </button>
          </form>
          <aside className="campaign-aside">
            <section className="panel">
              <h3>点数の意味を分けて表示</h3>
              <div>
                <span className="pill">既存投稿</span>
                <b>届けたい層への到達</b>
                <p>集計した反応ユーザーと、設定した目標割合を比較します。</p>
              </div>
              <div>
                <span className="pill">新しい候補</span>
                <b>発信内容との適合</b>
                <p>
                  プロフィール・最近の投稿を比較。フォロワーの属性や集客効果を保証するものではありません。
                </p>
              </div>
            </section>
            <section className="privacy-card">
              <h3>
                <ShieldCheck size={18} />
                予算とデータを守る
              </h3>
              <p>
                上限を超える追加取得は停止。画像は保存せず、鍵アカウントや未成年の可能性がある候補は推薦から除外します。
              </p>
            </section>
          </aside>
        </div>
      ) : stage === "confirm" && plan ? (
        <section className="panel plan-confirm">
          <h2>この評価基準で検索します</h2>
          <p className="goal-summary">{plan.summary}</p>
          <div className="query-chips">
            {plan.queries.map((q) => (
              <span key={q}>
                <Search size={13} />
                {q}
              </span>
            ))}
          </div>
          <h3>候補の適合スコア</h3>
          <div className="candidate-weights">
            {[
              ["発信テーマ", 40],
              ["対象層に関連する発信", 25],
              ["対象エリア", 15],
              ["最近の活動", 10],
              ["投稿への反応", 10],
            ].map(([name, weight]) => (
              <div key={name}>
                <span>{name}</span>
                <b>{weight}点</b>
              </div>
            ))}
          </div>
          <p className="form-hint">
            暫定の評価基準です。テーマに関連する投稿があり、60点以上・情報充足率70%以上の候補から最大10人を選びます。不明な項目を満点換算しません。
          </p>
          {plan.goal.sourceJobId && (
            <div className="reach-plan">
              <h3>既存PR投稿の目的スコア</h3>
              <p className="form-hint">
                目標割合に達すると、その項目が満点になります。ご自身の案件に合わせて変更できます。
              </p>
              {plan.criteria.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>評価項目</th>
                        <th>配点</th>
                        <th>満点となる目標割合</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.criteria.map((c, i) => (
                        <tr key={c.id}>
                          <td>{c.label}</td>
                          <td>
                            <input
                              aria-label={`${c.label}の配点`}
                              type="number"
                              min={0}
                              max={100}
                              value={c.weight}
                              onChange={(e) =>
                                setPlan({
                                  ...plan,
                                  criteria: plan.criteria.map((v, j) =>
                                    j === i
                                      ? { ...v, weight: Number(e.target.value) }
                                      : v,
                                  ),
                                })
                              }
                            />{" "}
                            点
                          </td>
                          <td>
                            <input
                              aria-label={`${c.label}の目標割合`}
                              type="number"
                              min={1}
                              max={100}
                              value={Math.round(c.target * 100)}
                              onChange={(e) =>
                                setPlan({
                                  ...plan,
                                  criteria: plan.criteria.map((v, j) =>
                                    j === i
                                      ? {
                                          ...v,
                                          target: Number(e.target.value) / 100,
                                        }
                                      : v,
                                  ),
                                })
                              }
                            />{" "}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="error">
                  この条件に対応する反応ユーザーの属性がありません。既存投稿の評価は「判定材料不足」と表示し、候補の推薦のみ行います。
                </p>
              )}
              {plan.criteria.length > 0 && (
                <p className={totalWeight === 100 ? "form-hint" : "error"}>
                  配点の合計：{totalWeight} / 100点
                </p>
              )}
            </div>
          )}
          <div className="search-estimate">
            <div>
              <span>予算上限</span>
              <b>3,000円 / 回</b>
            </div>
            <div>
              <span>今回の実行費用</span>
              <b>0円（モック）</b>
            </div>
            <div>
              <span>調査範囲</span>
              <b>最大100人 × 20投稿</b>
            </div>
          </div>
          <p className="form-hint">
            10人に満たない場合は、その人数で返します。実データ検索はAPI・料金上限の検証後に有効化します。
          </p>
          <div className="plan-actions">
            <button className="btn" onClick={() => setStage("goal")}>
              <ChevronLeft size={16} />
              条件を編集
            </button>
            <button
              className="btn primary"
              onClick={() => void start()}
              disabled={
                busy || (plan.criteria.length > 0 && totalWeight !== 100)
              }
            >
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Search size={16} />
              )}
              この条件で候補を探す
            </button>
          </div>
        </section>
      ) : current ? (
        <DiscoveryResults
          job={current}
          onRetry={async () => {
            await api("/api/campaigns/" + current.id + "/retry", {});
            setCurrent(await api<SearchJob>("/api/campaigns/" + current.id));
          }}
        />
      ) : null}
      {history.length > 0 && stage === "goal" && (
        <section className="panel search-history">
          <div className="panel-header">
            <h2>これまでの検索</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>目的</th>
                  <th>状態</th>
                  <th>費用 / 上限</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <button onClick={() => void open(j.id)}>
                        {j.plan.summary}
                      </button>
                    </td>
                    <td>
                      {j.status === "completed"
                        ? "完了"
                        : j.status === "queued"
                          ? "待機中"
                          : j.status === "error"
                            ? "エラー"
                            : j.status === "budget_stopped"
                              ? "予算上限で停止"
                              : "検索中"}
                    </td>
                    <td>
                      {money(j.spent_yen)} / {money(j.budget_yen)}
                    </td>
                    <td>
                      <button
                        className="detail-button"
                        onClick={() => void open(j.id)}
                      >
                        表示
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
function DiscoveryResults({
  job,
  onRetry,
}: {
  job: SearchJob;
  onRetry: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Recommendation | null>(null);
  if (job.status !== "completed")
    return (
      <section className="panel processing">
        {["error", "budget_stopped"].includes(job.status) ? (
          <>
            <Info size={32} style={{ margin: "auto" }} />
            <h2>
              {job.status === "budget_stopped"
                ? "予算上限で停止しました"
                : "検索を一時停止しました"}
            </h2>
            <p>{job.error}</p>
            {job.status === "error" && (
              <button
                className="btn primary"
                style={{ marginTop: 20 }}
                onClick={() => void onRetry()}
              >
                <RefreshCw size={16} />
                保存済みの地点から再開
              </button>
            )}
          </>
        ) : (
          <>
            <Loader2
              size={34}
              className="spin"
              style={{ margin: "auto", color: "#355bd9" }}
            />
            <h2>案件に合う候補を比較しています</h2>
            <p>プロフィールと直近20投稿を評価中。画面を離れても続きます。</p>
            <div className="progress-track">
              <i style={{ width: job.progress + "%" }} />
            </div>
            <p>
              {job.progress}% 完了 · 実績 {money(job.spent_yen)} / 上限{" "}
              {money(job.budget_yen)}
            </p>
          </>
        )}
      </section>
    );
  const report = job.report!,
    recommendations = report.recommendations,
    reach = report.reach;
  return (
    <>
      <div className="goal-result-header">
        <CheckCircle2 size={22} />
        <div>
          <h2>案件に合いそうな候補を{recommendations.length}人見つけました</h2>
          <p>{job.plan.summary}</p>
        </div>
      </div>
      <div className="discovery-stats">
        <div>
          <span>調査した候補</span>
          <b>{report.searched}人</b>
        </div>
        <div>
          <span>公開情報で評価</span>
          <b>{report.analyzed}人</b>
        </div>
        <div>
          <span>推薦</span>
          <b>{recommendations.length}人</b>
        </div>
        <div>
          <span>利用料 / 上限</span>
          <b>
            {money(job.spent_yen)} <small>/ {money(job.budget_yen)}</small>
          </b>
        </div>
      </div>
      {reach && (
        <section className="panel reach-result">
          <div className="score-overview">
            <span>
              既存PR投稿の目的スコア{reach.referenceOnly ? "（参考評価）" : ""}
            </span>
            <div>
              <b>{reach.score ?? "—"}</b>
              <span>/ 100</span>
              <strong>{reach.label}</strong>
            </div>
            <p>
              情報充足率 {pc(reach.coverage)} / 分析済み公開アカウント{" "}
              {reach.denominator}人
            </p>
          </div>
          <div className="reach-parts">
            {reach.parts.map((c) => (
              <div key={c.id}>
                <b>{c.label}</b>
                <span>
                  実績 {pc(c.rate)} / 目標 {pc(c.target)}
                </span>
                <strong>
                  {c.points ?? "—"} / {c.weight}点
                </strong>
                <small>
                  該当 {c.matches}人・不明 {c.unknown}人
                </small>
              </div>
            ))}
          </div>
          {reach.referenceOnly && (
            <p className="error">
              取得率が低い、または算出できないため参考評価です。この点数だけで投稿全体の良し悪しを判断しないでください。
            </p>
          )}
          <p className="form-hint">
            {reach.notice}{" "}
            分析人数30人未満、または情報充足率70%未満は点数を表示しません。
          </p>
          <p className="form-hint">
            データ取得率：いいね{" "}
            {reach.acquisition.like === null
              ? "算出不可"
              : pc(reach.acquisition.like)}{" "}
            / コメント{" "}
            {reach.acquisition.comment === null
              ? "算出不可"
              : pc(reach.acquisition.comment)}
            。取得できた人の評価であり、投稿全体への到達を保証しません。
          </p>
        </section>
      )}
      <section className="panel recommendation-panel">
        <div className="panel-header">
          <div>
            <h2>推薦インフルエンサー</h2>
            <p className="panel-subtitle">
              発信内容の適合度順。点数と反応ユーザーの属性は別の評価です。
            </p>
          </div>
          <span className="pill">架空データ</span>
        </div>
        {recommendations.length ? (
          <div className="recommendation-list">
            {recommendations.map((r, i) => (
              <article className="recommendation-card" key={r.candidate.id}>
                <span className="recommendation-rank">{i + 1}</span>
                <div className="recommendation-person">
                  <a
                    href={r.candidate.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @{r.candidate.username}
                    <ExternalLink size={13} />
                  </a>
                  <h3>{r.candidate.name}</h3>
                  <p>{r.candidate.bio}</p>
                  <small>
                    フォロワー{" "}
                    {r.candidate.followers?.toLocaleString() ?? "不明"}人 / 投稿{" "}
                    {r.candidate.posts.length}件を確認
                  </small>
                </div>
                <div className="recommendation-score">
                  <b>
                    {r.assessment.score}
                    <span>/100</span>
                  </b>
                  <span>{r.assessment.label}</span>
                  <small>情報充足率 {pc(r.assessment.coverage)}</small>
                </div>
                <button className="btn" onClick={() => setSelected(r)}>
                  評価の内訳
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">
            <Users size={28} style={{ margin: "0 auto 12px" }} />
            <h3>基準を満たす候補は見つかりませんでした</h3>
            <p>
              人数を埋めるために基準を下げず、目的や検索条件の見直しをご検討ください。
            </p>
          </div>
        )}
        <p className="user-list-note">{report.notice}</p>
      </section>
      {selected && (
        <CandidateDialog
          recommendation={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function CandidateDialog({
  recommendation: r,
  onClose,
}: {
  recommendation: Recommendation;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      ref.current?.close();
      document.body.style.overflow = old;
      before?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="user-drawer"
      aria-labelledby="candidate-score-title"
      onCancel={onClose}
    >
      <header className="drawer-header">
        <div>
          <span className="drawer-kicker">適合スコアの内訳</span>
          <h2 id="candidate-score-title">{r.candidate.name}</h2>
          <p>
            {r.assessment.score} / 100点 · {r.assessment.label}
          </p>
        </div>
        <button
          autoFocus
          className="icon-button"
          aria-label="評価の内訳を閉じる"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </header>
      <div className="drawer-content">
        <a
          className="btn profile-cta"
          href={r.candidate.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          デモプロフィールを開く
          <ExternalLink size={15} />
        </a>
        {r.assessment.parts.map((part) => (
          <section className="candidate-score-part" key={part.id}>
            <div>
              <h3>{part.label}</h3>
              <b>
                {part.points ?? "不明"} / {part.weight}点
              </b>
            </div>
            <div className="progress-track">
              <i
                style={{ width: part.value === null ? "0%" : pc(part.value) }}
              />
            </div>
            <p>{part.reason}</p>
            {part.evidence.length > 0 && (
              <small>根拠にした投稿：{part.evidence.length}件</small>
            )}
          </section>
        ))}
        <p className="detail-disclaimer">
          反応ユーザーを取得していないため、実際に届く層や来場・購買成果は未評価です。観測できない項目は不明として扱います。
        </p>
      </div>
      <footer className="drawer-footer">
        <button className="btn" onClick={onClose}>
          候補一覧に戻る
        </button>
      </footer>
    </dialog>
  );
}
