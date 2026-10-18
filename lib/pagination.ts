/**
 * Shared bounds for the list endpoints.
 *
 * Both routes hand a raw query string to Number(), which yields NaN for anything
 * unexpected, and then either slice with it (silently returning an empty page and
 * an unusable next cursor) or pass it to a LIMIT. Every bound is clamped here so
 * one place decides what a bad parameter means: fall back to the default.
 */
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * A whole number within [min, max]. Absent, non-numeric, fractional, negative or
 * over the cap all collapse to `fallback`, so a hostile or merely stale query
 * string cannot ask for an unbounded page or a nonsensical offset.
 */
export function clampInt(
    raw: string | null | undefined,
    {
        min,
        max,
        fallback,
    }: {
        min: number;
        max: number;
        fallback: number;
    },
): number {
    const value = Number(raw);

    if (!Number.isInteger(value)) return fallback;

    if (value < min) return fallback;
    if (value > max) return max;

    return value;
}

/** Page size: absent or bogus means the default, merely large means the cap. */
export function clampLimit(raw: string | null | undefined): number {
    return clampInt(raw, { min: 1, max: MAX_LIMIT, fallback: DEFAULT_LIMIT });
}

/** Offset: never negative, capped so a hand-written cursor cannot scan the table. */
export function clampOffset(raw: string | null | undefined): number {
    return clampInt(raw, { min: 0, max: Number.MAX_SAFE_INTEGER, fallback: 0 });
}