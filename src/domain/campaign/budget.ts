import { SEARCH_BUDGET_JPY } from "./types";
export function projectedYen(
  usd: number,
  fx: number,
  taxMultiplier = 1.1,
  buffer = 1.15,
) {
  if (
    ![usd, fx, taxMultiplier, buffer].every(Number.isFinite) ||
    usd < 0 ||
    fx <= 0 ||
    taxMultiplier < 1 ||
    buffer < 1
  )
    throw Error("費用条件が不正です");
  return Math.ceil(usd * fx * taxMultiplier * buffer);
}
export function canReserve(
  spent: number,
  reserved: number,
  next: number,
  limit = SEARCH_BUDGET_JPY,
) {
  return (
    [spent, reserved, next, limit].every(
      (v) => Number.isSafeInteger(v) && v >= 0,
    ) &&
    limit <= SEARCH_BUDGET_JPY &&
    spent + reserved + next <= limit
  );
}
