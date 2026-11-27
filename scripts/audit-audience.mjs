import { readdir, readFile, stat } from 'node:fs/promises';
import { audienceCoverage } from './lib/audience-coverage.mjs';
try {
  const args = process.argv.slice(2), index = args.indexOf('--file');
  let files;
  if (index >= 0) {
    const file = args[index + 1];
    if (!file || !/^\.p0-results\/audience-[\w-]+\.json$/.test(file)) throw Error('対象ファイルの指定を確認してください');
    files = [file];
  } else {
    files = (await readdir('.p0-results')).filter(f => /^audience-[\w-]+\.json$/.test(f)).map(f => '.p0-results/' + f);
  }
  let latest;
  for (const file of files) {
    if ((await stat(file)).size > 2 * 1024 * 1024) throw Error('ファイルが大きすぎるため停止しました');
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (data.status !== 'completed' || !data.audience) continue;
    const at = Date.parse(data.audience.analyzedAt);
    if (Number.isFinite(at) && (!latest || at > latest.at)) latest = { at, data };
  }
  if (!latest) throw Error('完了済みのaudienceファイルが見つかりません');
  const a = audienceCoverage(latest.data);
  const ratio = n => `${n}/${a.processed}人${a.processed ? `（${(100*n/a.processed).toFixed(1)}%）` : ''}`;
  console.log('=== 保存データの情報不足チェック ===');
  console.log('外部通信なし・API課金なし・ファイル変更なし');
  console.log(`処理完了：${a.processed}人`);
  console.log(`プロフィール：公開 ${a.public}人 ／ 非公開 ${a.private}人 ／ 保存プロフィールとの対応なし ${a.missing}人`);
  console.log(`公開のうち：自己紹介が空 ${a.publicEmptyBio}人 ／ 投稿本文なし ${a.publicNoPostText}人 ／ 両方なし ${a.publicNoText}人`);
  console.log(`公開で本文あり：${a.publicWithText}人 ／ 投稿本文をAIに使用できた対象：${a.profilesWithPostsUsed}人`);
  console.log(`保存投稿本文 ${a.postsAvailable}件 ／ 1500文字枠で使用できた投稿本文 ${a.postsUsed}件`);
  console.log(`保存本文のうち入力枠で切り捨て：${a.truncatedProfiles}人・合計${a.savedCharsOmitted}文字`);
  console.log('※保存前に削った本文量と、Instagram上の未取得投稿数はこの記録からは分かりません。');
  console.log('根拠付きの判定：性別 '+ratio(a.genderKnown)+' ／ 年代 '+ratio(a.ageKnown)+' ／ 関心 '+ratio(a.interestKnown));
  console.log(`AI自己評価100%の項目数：${a.selfRated100Findings}（正答率ではありません）`);
  console.log(`追加投稿取得の検討対象：公開かつ保存投稿本文なし ${a.needsPublicPosts}人`);
  console.log('非公開や自己記述のない属性は、追加取得でも解決できない場合があります。');
} catch {
  console.error('診断できませんでした。reach-insightフォルダで、前回完了したaudience JSONが残っているか確認してください。個人情報を含むファイル内容は送らないでください。');
  process.exitCode = 1;
}
