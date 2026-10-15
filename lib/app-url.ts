export function appUrl(path = "/") {
    const base =
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.BETTER_AUTH_URL ??
        "http://localhost:3000";

    return new URL(path, base);
}

