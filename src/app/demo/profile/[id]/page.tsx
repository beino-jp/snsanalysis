import { redirect, notFound } from "next/navigation";
import { requireAuth } from "@/server/auth";
import { fixtures } from "@/fixtures/demo";
export default async function DemoProfile({
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
  const profile = fixtures(new Date().toISOString()).profiles.find(
    (p) => p.id === id,
  );
  if (!profile || profile.private || profile.bio.includes("17歳")) notFound();
  return (
    <main className="demo-profile">
      <span className="pill">架空のプロフィール / MOCK DATA</span>
      <div className="demo-profile-avatar">
        {profile.displayName.slice(0, 1)}
      </div>
      <h1>@{profile.username}</h1>
      <h2>{profile.displayName}</h2>
      <p style={{ whiteSpace: "pre-wrap", margin: "20px 0" }}>{profile.bio}</p>
      <p className="muted">
        フォロワー {profile.followers?.toLocaleString()}人
      </p>
      <div className="demo-banner" style={{ marginTop: 30, textAlign: "left" }}>
        この画面はデモ用です。実在するInstagramアカウントではありません。実データ接続時は、一覧のリンクからInstagramプロフィールを新しいタブで開きます。
      </div>
      <p className="muted small">このタブを閉じると分析結果へ戻れます。</p>
    </main>
  );
}
