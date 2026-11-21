import { redirect, notFound } from "next/navigation";
import { requireAuth } from "@/server/auth";
import { MockDiscoveryProvider } from "@/providers/campaign/mock";
export default async function DemoInfluencer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requireAuth();
  } catch {
    redirect("/login");
  }
  const { id } = await params;
  if (!/^\d{1,3}$/.test(id) || Number(id) < 1 || Number(id) > 100) notFound();
  const candidate = await new MockDiscoveryProvider(
    new Date().toISOString(),
  ).candidate(`sample_creator_${id.padStart(3, "0")}`, 20);
  if (candidate.minor || candidate.private) notFound();
  return (
    <main className="demo-profile">
      <span className="pill">架空のインフルエンサー / MOCK DATA</span>
      <div className="demo-profile-avatar">{candidate.name.slice(0, 1)}</div>
      <h1>@{candidate.username}</h1>
      <h2>{candidate.name}</h2>
      <p style={{ margin: "20px 0" }}>{candidate.bio}</p>
      <p className="muted">
        フォロワー {candidate.followers?.toLocaleString()}人
      </p>
      <div className="demo-banner" style={{ marginTop: 25 }}>
        これは推薦機能のデモ用プロフィールです。実在のアカウントではありません。
      </div>
      <h3 style={{ textAlign: "left", margin: "25px 0" }}>
        最近の投稿のサンプル
      </h3>
      {candidate.posts.slice(0, 3).map((p) => (
        <article key={p.id} className="demo-post">
          <p>{p.caption}</p>
          <small>
            {p.at.slice(0, 10)} · いいね {p.likes ?? "非公開"}
          </small>
        </article>
      ))}
    </main>
  );
}
