const MIN_PLAUSIBLE_REGISTERED_AT = 946684800; // 2000-01-01T00:00:00Z
const MAX_FUTURE_SKEW_SECONDS = 366 * 24 * 60 * 60;

export function normalizeRegisteredAt(
  value: number | string | bigint | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000)
): number {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return 0;

  const wholeSeconds = Math.trunc(timestamp);
  if (wholeSeconds < MIN_PLAUSIBLE_REGISTERED_AT) return 0;
  if (wholeSeconds > nowSeconds + MAX_FUTURE_SKEW_SECONDS) return 0;

  return wholeSeconds;
}
