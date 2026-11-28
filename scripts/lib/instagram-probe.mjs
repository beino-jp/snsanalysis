export function probePlan(raw) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    !["instagram.com", "www.instagram.com"].includes(u.hostname) ||
    !/^\/p\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)
  )
    throw Error("公開Instagram投稿URLを指定してください");
  const url = `https://www.instagram.com${u.pathname.replace(/\/?$/, "/")}`;
  return {
    url,
    shortcode: u.pathname.split("/")[2],
    budgetYen: 300,
    maxChargeUsd: 0.1,
    conversionCeiling: 200,
    feesMultiplier: 1.5,
    steps: [
      {
        key: "post",
        actor: "apify/instagram-scraper",
        limit: 1,
        cap: 0.01,
        input: {
          directUrls: [url],
          resultsType: "details",
          resultsLimit: 1,
          addParentData: false,
        },
      },
      {
        key: "comments",
        actor: "apify/instagram-comment-scraper",
        limit: 20,
        cap: 0.09,
        input: {
          directUrls: [url],
          resultsLimit: 20,
          includeNestedComments: false,
        },
      },
    ],
  };
}
export function validatePricing(actor, step, now = Date.now()) {
  const info = (actor.pricingInfos ?? [])
    .filter((p) => Date.parse(p.startedAt) <= now)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
  if (
    info?.pricingModel !== "PAY_PER_EVENT" ||
    Number(info.minimalMaxTotalChargeUsd ?? 0) > step.cap
  )
    throw Error("料金方式または課金上限の最低設定額が変わったため停止");
  const entries = info.pricingPerEvent?.actorChargeEvents ?? {};
  const profileOnly = step.key === "profiles" && step.input?.includeAboutSection === false;
  const keys = Object.keys(entries);
  if (profileOnly && (keys.length !== 2 || !keys.includes("profile") || !keys.includes("about-account")))
    throw Error("プロフィールの課金項目が既知の仕様と一致しません");
  const events = profileOnly ? [entries.profile] : Object.values(entries);
  if (events.length !== 1) throw Error("追加課金項目があるため停止");
  const prices = events.flatMap((e) =>
    e.eventPriceUsd !== undefined
      ? [e.eventPriceUsd]
      : Object.values(e.eventTieredPricingUsd ?? {}).map(
          (t) => t.tieredEventPriceUsd,
        ),
  );
  if (
    !prices.length ||
    prices.some((n) => !Number.isFinite(n) || n < 0) ||
    Math.max(...prices) * step.limit > step.cap
  )
    throw Error("取得予定件数の費用が予約枠に収まりません");
  return info;
}
export function validateBuild(build, step) {
  const schema = JSON.parse(build.inputSchema ?? "{}");
  const props = schema.properties ?? {};
  if (
    (step.key === "profiles" ? (!props.usernames || props.includeAboutSection?.type !== "boolean" || step.input?.includeAboutSection !== false) : !props.directUrls) ||
    (step.key !== "profiles" && !props.resultsLimit) ||
    (step.key === "post" && !props.resultsType?.enum?.includes("details")) ||
    (step.key === "comments" && !props.includeNestedComments)
  )
    throw Error("Actor入力仕様が変わったため停止");
  return build.buildNumber;
}
export function summarize(items, key) {
  if (key === "profiles") {
    if (items.some(p => !p.username || p.error)) throw Error("プロフィール出力形式が不正です");
    return {profileRecords:items.length};
  }
  if (key === "post") {
    const p = items[0];
    if (
      !p ||
      p.error ||
      p.errorDescription ||
      !p.id ||
      !Number.isFinite(p.likesCount) ||
      !Number.isFinite(p.commentsCount)
    )
      throw Error("投稿情報を正常取得できませんでした");
    return {
      postRecords: 1,
      displayedLikes: p.likesCount,
      displayedComments: p.commentsCount,
    };
  }
  if (
    items.some(
      (p) =>
        p.error ||
        p.errorDescription ||
        !p.id ||
        typeof p.text !== "string" ||
        (!p.ownerUsername && !p.ownerId && !p.owner?.username),
    )
  )
    throw Error("コメント出力が正常な形式ではありません");
  return {
    commentRecords: items.length,
    uniqueCommenters: new Set(
      items.map(
        (p) => p.ownerId ?? p.owner?.id ?? p.ownerUsername ?? p.owner?.username,
      ),
    ).size,
  };
}
export async function executeProbe(client, plan, journal, save, onItems) {
  if (
    plan.maxChargeUsd * plan.conversionCeiling * plan.feesMultiplier >
    plan.budgetYen
  )
    throw Error("円換算の予算超過");
  // Inspect BOTH actors before starting any paid operation.
  const prepared = [];
  for (const step of plan.steps) {
    const actor = await client.actor(step.actor).get();
    if (!actor) throw Error("Actorを確認できません");
    validatePricing(actor, step);
    const build = await (await client.actor(step.actor).defaultBuild()).get();
    if (!build) throw Error("Buildを確認できません");
    prepared.push({ ...step, build: validateBuild(build, step) });
  }
  journal.status = "ready";
  await save();
  for (const step of prepared) {
    const entry = {
      key: step.key,
      actor: step.actor,
      build: step.build,
      status: "starting",
      capUsd: step.cap,
    };
    journal.runs.push(entry);
    await save();
    // Start is intentionally not retried. An ambiguous network failure requires console inspection.
    let run;
    try {
      run = await client
        .actor(step.actor)
        .start(step.input, {
          build: step.build,
          maxTotalChargeUsd: step.cap,
          timeout: 120,
          memory: 512,
        });
      entry.runId = run.id;
      entry.status = run.status;
      await save();
      const deadline = Date.now() + 180000;
      while (
        !["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(run.status) &&
        Date.now() < deadline
      ) {
        run = await client.run(run.id).waitForFinish({ waitSecs: 10 });
        if (!run) throw Error("実行状態を確認できません");
      }
      if (run.status !== "SUCCEEDED") throw Error("Actorが成功しませんでした");
      if (
        run.pricingInfo?.pricingModel !== "PAY_PER_EVENT" ||
        !Number.isFinite(run.usageTotalUsd) ||
        run.usageTotalUsd > step.cap
      )
        throw Error("課金方式・実績が予約枠と一致しません");
      entry.costUsd = run.usageTotalUsd;
      const page = await client
        .dataset(run.defaultDatasetId)
        .listItems({ limit: step.limit + 1, clean: true });
      if (page.total > step.limit)
        throw Error("取得件数が上限を超えたため停止");
      entry.summary = summarize(page.items, step.key);
      if (onItems) await onItems(step.key, page.items);
      entry.status = "verified";
    } finally {
      if (!run) {
        entry.status = "start_unknown";
        journal.status = "manual_check_required";
        await save();
      } else {
        entry.cleanup = "pending";
        await save();
        try {
          const latest = await client.run(run.id).get();
          if (!latest) throw Error("実行状態不明");
          if (
            !["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(
              latest.status,
            )
          )
            await client.run(run.id).abort();
          const stopped = await client
            .run(run.id)
            .waitForFinish({ waitSecs: 10 });
          if (
            !stopped ||
            !["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(
              stopped.status,
            )
          )
            throw Error("停止未確認");
          for (const [store, id] of [
            ["dataset", stopped.defaultDatasetId],
            ["keyValueStore", stopped.defaultKeyValueStoreId],
            ["requestQueue", stopped.defaultRequestQueueId],
          ])
            if (id) await client[store](id).delete();
          await client.run(run.id).delete();
          entry.cleanup = "deleted";
          await save();
        } catch {
          entry.cleanup = "manual_cleanup_required";
          journal.status = "manual_check_required";
          await save();
          throw Error(
            "停止または外部保存先の削除を確認できません。Apify Consoleで確認してください",
          );
        }
      }
    }
  }
  journal.status = "completed";
  await save();
}
