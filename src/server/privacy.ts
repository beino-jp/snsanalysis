const blocked =
  /image|picture|thumbnail|cookie|token|secret|avatar|password|authorization|displayUrl|videoUrl/i;
export function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !blocked.test(k))
        .map(([k, v]) => [k, sanitize(v)]),
    );
  return value;
}
