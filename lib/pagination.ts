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

/**
 * An opaque keyset cursor.
 *
 * The sort is (updatedAt desc, id desc), so the cursor has to carry both halves:
 * a cursor on updatedAt alone silently drops every row that shares a timestamp
 * with the last row of the previous page. Encoding it keeps that contract out of
 * the query string, so it can be added to later without breaking old links.
 */
export function encodeCursor(values: Record<string, string>): string {
    return Buffer.from(JSON.stringify(values), "utf8").toString("base64url");
}

/**
 * Returns null for anything that is not a cursor this server produced, which
 * includes truncated, hand-edited and cross-route tokens. Callers reject those
 * with a 400 rather than silently restarting from the first page, because
 * ignoring a bad cursor would quietly show a duplicate page instead of an error.
 */
export function decodeCursor(raw: string): Record<string, string> | null {
    let decoded: unknown;

    try {
        decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    } catch {
        return null;
    }

    if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
        return null;
    }

    const entries = Object.entries(decoded as Record<string, unknown>);

    if (entries.length === 0) return null;

    const values: Record<string, string> = {};

    for (const [key, value] of entries) {
        if (typeof value !== "string") return null;
        values[key] = value;
    }

    return values;
}