"use client";
import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Search,
  Users,
  LockKeyhole,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Heart,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import type { AnalyzedUser } from "@/domain/analyzed-users";
const percent = (v: number) => `${Math.round(v * 100)}%`;
const skateClass = (label: string) =>
  label === "行った（確度高）"
    ? "went"
    : label === "可能性あり"
      ? "maybe"
      : label === "観戦"
        ? "watch"
        : "none";
export default function AnalyzedUsers({
  users,
  channel,
  initialSkate = "all",
}: {
  users: AnalyzedUser[];
  channel: "like" | "comment" | "unique";
  initialSkate?: string;
}) {
  const [search, setSearch] = useState(""),
    [tag, setTag] = useState("all"),
    [skate, setSkate] = useState(initialSkate),
    [sort, setSort] = useState("name"),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<AnalyzedUser | null>(null);
  useEffect(() => {
    setPage(0);
    setSelected(null);
  }, [channel]);
  const inChannel = users.filter(
    (u) => channel === "unique" || u.reactions.includes(channel),
  );
  const tags = [...new Set(users.flatMap((u) => u.tags.map((t) => t.name)))];
  const filtered = inChannel
    .filter(
      (u) =>
        (tag === "all" || u.tags.some((t) => t.name === tag)) &&
        (skate === "all" || u.skate.label === skate) &&
        `${u.name} ${u.displayName}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "score"
        ? b.skate.score - a.skate.score
        : sort === "tags"
          ? b.tags.length - a.tags.length
          : a.name.localeCompare(b.name, "ja"),
    );
  const current = Math.min(
      page,
      Math.max(0, Math.ceil(filtered.length / 20) - 1),
    ),
    visible = filtered.slice(current * 20, current * 20 + 20),
    hasFilters = !!search || tag !== "all" || skate !== "all";
  function reset() {
    setSearch("");
    setTag("all");
    setSkate("all");
    setPage(0);
  }
  return (
    <section className="panel people-panel" aria-label="分析済みユーザー一覧">
      <div className="panel-header">
        <div>
          <h2>
            <Users size={19} />
            分析済みユーザー{" "}
            <span className="count-chip">{inChannel.length}人</span>
          </h2>
          <p className="panel-subtitle">
            タグと属性を比較し、「詳細」で選定理由を確認できます。
          </p>
        </div>
        <span className="internal-label">
          <ShieldCheck size={14} />
          社内限定
        </span>
      </div>
      <div className="people-tools">
        <div className="search">
          <Search size={18} />
          <input
            aria-label="分析済みユーザーを検索"
            placeholder="ユーザー名で検索"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
          {search && (
            <button
              aria-label="検索をクリア"
              onClick={() => {
                setSearch("");
                setPage(0);
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <label>
          関心タグ
          <select
            className="select"
            aria-label="該当タグで絞り込む"
            value={tag}
            onChange={(e) => {
              setTag(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">すべてのタグ</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          スケート判定
          <select
            className="select"
            aria-label="スケート判定で絞り込む"
            value={skate}
            onChange={(e) => {
              setSkate(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">すべての判定</option>
            {["行った（確度高）", "可能性あり", "観戦", "該当なし"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          並び順
          <select
            className="select"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
          >
            <option value="name">ユーザー名順</option>
            <option value="score">スケートのスコア順</option>
            <option value="tags">該当タグが多い順</option>
          </select>
        </label>
      </div>
      <div className="filter-summary" aria-live="polite">
        <span>
          <b>{filtered.length}</b>人{hasFilters && ` / ${inChannel.length}人`}
        </span>
        {hasFilters ? (
          <button onClick={reset}>
            <X size={14} />
            条件をクリア
          </button>
        ) : (
          <span>名前からプロフィールを開けます</span>
        )}
      </div>
      {visible.length ? (
        <div className="table-wrap">
          <table className="people-table">
            <thead>
              <tr>
                <th scope="col">ユーザー</th>
                <th scope="col">反応</th>
                <th scope="col">推定属性</th>
                <th scope="col">関心タグ</th>
                <th scope="col">スケート判定</th>
                <th scope="col">
                  <span className="sr-only">詳細を確認</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.key}>
                  <td data-label="ユーザー">
                    <div className="person-identity">
                      <span
                        className={
                          "person-avatar " + (u.masked ? "is-masked" : "")
                        }
                      >
                        {u.masked ? (
                          <LockKeyhole size={18} />
                        ) : (
                          u.displayName.slice(0, 1)
                        )}
                      </span>
                      <div>
                        {u.profileUrl ? (
                          <a
                            href={u.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="profile-link"
                          >
                            @{u.name}
                            <ExternalLink size={13} />
                          </a>
                        ) : (
                          <strong>{u.name}</strong>
                        )}
                        <span className="person-name">
                          {u.masked ? "プライバシー保護" : u.displayName}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td data-label="反応">
                    <div className="reaction-icons">
                      {u.reactions.map((r) => (
                        <span
                          key={r}
                          title={r === "like" ? "いいね" : "コメント"}
                        >
                          {r === "like" ? (
                            <Heart size={14} />
                          ) : (
                            <MessageCircle size={14} />
                          )}
                          <span>{r === "like" ? "いいね" : "コメント"}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td data-label="推定属性">
                    <span className="attribute-value">
                      {u.gender} <span className="muted">/</span> {u.age}
                    </span>
                  </td>
                  <td data-label="関心タグ">
                    <div className="compact-tags">
                      {u.tags.length ? (
                        u.tags.map((t) => (
                          <button
                            key={t.name}
                            onClick={() => {
                              setTag(t.name);
                              setPage(0);
                            }}
                            aria-label={`${t.name}で絞り込む`}
                          >
                            {t.name}
                          </button>
                        ))
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </div>
                  </td>
                  <td data-label="スケート判定">
                    <span
                      className={"skate-badge " + skateClass(u.skate.label)}
                    >
                      {u.skate.label}
                    </span>
                  </td>
                  <td>
                    <button
                      className="detail-button"
                      aria-label={`${u.name}の判定詳細`}
                      onClick={() => setSelected(u)}
                    >
                      詳細
                      <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty people-empty">
          <SlidersHorizontal size={28} />
          <h3>条件に一致するユーザーがいません</h3>
          <p>検索ワードやタグを変更して、もう一度お試しください。</p>
          {hasFilters && (
            <button className="btn" onClick={reset}>
              すべてのユーザーを表示
            </button>
          )}
        </div>
      )}
      <div className="panel-footer">
        <span>
          {filtered.length ? current * 20 + 1 : 0}–
          {Math.min((current + 1) * 20, filtered.length)} / {filtered.length}人
        </span>
        <div className="pagination">
          <button
            aria-label="前のページ"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            {current + 1} / {Math.max(1, Math.ceil(filtered.length / 20))}
          </span>
          <button
            aria-label="次のページ"
            disabled={(current + 1) * 20 >= filtered.length}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <p className="user-list-note">
        <LockKeyhole size={13} />
        10代は個人識別情報を非表示。デモのリンク先は架空のプロフィールです。
      </p>
      {selected && (
        <UserDrawer user={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
function UserDrawer({
  user: u,
  onClose,
}: {
  user: AnalyzedUser;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const before = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = old;
      before?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="user-drawer"
      aria-labelledby="user-detail-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header className="drawer-header">
        <div>
          <span className="drawer-kicker">ユーザーの判定詳細</span>
          <h2 id="user-detail-title">{u.masked ? u.name : `@${u.name}`}</h2>
          <p>{u.displayName}</p>
        </div>
        <button
          autoFocus
          className="icon-button"
          aria-label="詳細を閉じる"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </header>
      <div className="drawer-content">
        {u.masked ? (
          <div className="privacy-callout">
            <LockKeyhole size={18} />
            10代と推定されたため、名前・リンク・根拠の文章を伏せています。
          </div>
        ) : (
          u.profileUrl && (
            <a
              className="btn profile-cta"
              href={u.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} />
              {u.demo
                ? "デモプロフィールを開く"
                : "Instagramプロフィールを開く"}
            </a>
          )
        )}
        <section className="detail-section">
          <h3>推定属性</h3>
          <div className="attribute-cards">
            <div>
              <span>性別</span>
              <b>{u.gender}</b>
              <small>確信度 {percent(u.genderConfidence)}</small>
            </div>
            <div>
              <span>年代</span>
              <b>{u.age}</b>
              <small>確信度 {percent(u.ageConfidence)}</small>
            </div>
          </div>
          <p className="detail-reason">{u.reason}</p>
        </section>
        <section className="detail-section">
          <h3>
            該当した関心タグ <span className="count-chip">{u.tags.length}</span>
          </h3>
          {u.tags.length ? (
            u.tags.map((t) => (
              <article className="tag-evidence" key={t.name}>
                <div>
                  <span className="pill">{t.name}</span>
                  <span>確信度 {percent(t.confidence)}</span>
                </div>
                <dl>
                  {t.criterion && (
                    <>
                      <dt>判定条件</dt>
                      <dd>{t.criterion}</dd>
                    </>
                  )}
                  <dt>このユーザーの根拠</dt>
                  <dd>{t.reason}</dd>
                </dl>
              </article>
            ))
          ) : (
            <p className="detail-reason">
              該当するタグはありません。不明・非該当を含みます。
            </p>
          )}
        </section>
        <section className="detail-section">
          <h3>アイススケートの判定</h3>
          <div className="skate-detail">
            <span className={"skate-badge " + skateClass(u.skate.label)}>
              {u.skate.label}
            </span>
            <div>
              <b>{u.skate.score}点</b>
              <span>確信度 {percent(u.skate.confidence)}</span>
            </div>
          </div>
          <p className="detail-reason">{u.skate.reason}</p>
          <p className="detail-disclaimer">
            スコアだけで体験を確定せず、AI判定と除外ルールを組み合わせています。
          </p>
        </section>
        <p className="detail-disclaimer">
          すべての属性は推定です。社外への共有は集計値に限定してください。
        </p>
      </div>
      <footer className="drawer-footer">
        <button className="btn" onClick={onClose}>
          一覧に戻る
        </button>
      </footer>
    </dialog>
  );
}
