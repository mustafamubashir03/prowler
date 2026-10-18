/**
 * Repository path guard for chat tools.
 *
 * Kept free of imports so it can be reasoned about and tested on its own: the
 * tools that use it do network I/O, and a path check should not need any.
 *
 * Rejecting is the whole policy. Cleaning a bad path would be worse, because
 * `lib/../secrets` quietly becomes `secrets` and the caller never learns their
 * request was malformed.
 */
export function safePath(path: string): string | null {
    if (typeof path !== "string") return null;
    if (path.length === 0 || path.length > 1024) return null;
    if (path.includes("\0")) return null;
    if (path.startsWith("/") || path.startsWith("\\")) return null;
    // Windows drive letter, e.g. C:\ or c:/
    if (/^[a-zA-Z]:/.test(path)) return null;

    const segments = path.split("/");

    // Empty segments mean a doubled slash or a trailing slash, which is not a
    // path we want to hand to the API.
    if (segments.some((segment) => segment === ".." || segment === "")) {
        return null;
    }

    return segments.join("/");
}