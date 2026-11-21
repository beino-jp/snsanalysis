import { query, transaction } from "./db";
import { canReserve } from "../domain/campaign/budget";
export async function reserveCharge(
  jobId: string,
  key: string,
  ceiling: number,
) {
  await transaction(async (q) => {
    const job = (
      await q("SELECT * FROM discovery_jobs WHERE id=$1 FOR UPDATE", [jobId])
    )[0];
    if (!job) throw Error("検索が見つかりません");
    if (!["queued", "running"].includes(job.status))
      throw Error("BUDGET_STOPPED");
    const existing = (
      await q("SELECT * FROM discovery_charges WHERE job_id=$1 AND key=$2", [
        jobId,
        key,
      ])
    )[0];
    if (existing) {
      if (existing.ceiling_yen !== ceiling)
        throw Error("費用予約の条件が一致しません");
      return;
    }
    if (!canReserve(job.spent_yen, job.reserved_yen, ceiling, job.budget_yen))
      throw Error("BUDGET_LIMIT");
    await q(
      "INSERT INTO discovery_charges(job_id,key,ceiling_yen) VALUES($1,$2,$3)",
      [jobId, key, ceiling],
    );
    await q(
      "UPDATE discovery_jobs SET reserved_yen=reserved_yen+$2 WHERE id=$1",
      [jobId, ceiling],
    );
  });
}
export async function settleCharge(jobId: string, key: string, actual: number) {
  if (!Number.isSafeInteger(actual) || actual < 0)
    throw Error("費用が不正です");
  await transaction(async (q) => {
    const job = (
      await q("SELECT * FROM discovery_jobs WHERE id=$1 FOR UPDATE", [jobId])
    )[0];
    if (!job) throw Error("検索が見つかりません");
    const charge = (
      await q("SELECT * FROM discovery_charges WHERE job_id=$1 AND key=$2", [
        jobId,
        key,
      ])
    )[0];
    if (!charge) throw Error("未予約の課金");
    if (charge.state === "settled") {
      if (charge.actual_yen !== actual) throw Error("費用確定額が一致しません");
      return;
    }
    await q(
      "UPDATE discovery_charges SET actual_yen=$3,state='settled' WHERE job_id=$1 AND key=$2",
      [jobId, key, actual],
    );
    await q(
      "UPDATE discovery_jobs SET spent_yen=spent_yen+$2,reserved_yen=reserved_yen-$3,status=CASE WHEN $2>$3 OR spent_yen+$2>budget_yen THEN 'budget_stopped' ELSE status END,error=CASE WHEN $2>$3 THEN '外部サービスの請求が予約額を超えたため停止しました' ELSE error END WHERE id=$1",
      [jobId, actual, charge.ceiling_yen],
    );
  });
}
