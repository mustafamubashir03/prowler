import { createSign } from "node:crypto";
import "dotenv/config";

/**
 * Pre-flight check for the two things that silently stop Prowler:
 *
 *   1. The installation token carries no permissions. GitHub reports this as
 *      `X-Accepted-GitHub-Permissions: allows_permissionless_access=true` with
 *      no permission entries, and every write then fails with
 *      403 "Resource not accessible by integration" even though
 *      `GET /app/installations` still advertises the permissions.
 *
 *   2. The stored OAuth refresh token is dead (`bad_refresh_token`), which kills
 *      the activity heatmap until the user signs in with GitHub again.
 *
 * Run this after installing, changing App permissions, or re-authorising,
 * BEFORE opening a PR:
 *
 *   pnpm app:check
 */

const b64url = (i) => Buffer.from(i).toString("base64url");

const key = (process.env.GITHUB_APP_PRIVATE_KEY ?? "")
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
    .trim();

if (!key || !process.env.GITHUB_APP_ID) {
    console.log("GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY are not set.");
    process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
const payload = b64url(
    JSON.stringify({
        iat: now - 60,
        exp: now + 540,
        iss: process.env.GITHUB_APP_ID,
    }),
);
const signer = createSign("RSA-SHA256");
signer.update(`${header}.${payload}`);
const jwt = `${header}.${payload}.${signer.sign(key, "base64url")}`;

const api = "https://api.github.com";
const appHeaders = {
    Authorization: `Bearer ${jwt}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "prowler-check",
};

let failures = 0;

// ---- 1. installation token permissions -------------------------------------
const app = await (await fetch(`${api}/app`, { headers: appHeaders })).json();

console.log("GitHub App:", app.slug);
console.log(
    "  app permissions:",
    Object.entries(app.permissions ?? {})
        .map(([k, v]) => `${k}:${v}`)
        .join(" "),
);

const installs = await (
    await fetch(`${api}/app/installations`, { headers: appHeaders })
).json();

if (!Array.isArray(installs) || installs.length === 0) {
    console.log("\n  FAIL  no installations on this App");
    failures += 1;
}

for (const install of installs) {
    console.log(`\n  installation ${install.id} on ${install.account?.login}`);
    console.log(
        "    advertised:",
        Object.entries(install.permissions ?? {})
            .map(([k, v]) => `${k}:${v}`)
            .join(" "),
    );

    const tokRes = await fetch(
        `${api}/app/installations/${install.id}/access_tokens`,
        { method: "POST", headers: appHeaders },
    );
    const tok = await tokRes.json();

    if (!tok.token) {
        console.log(`    FAIL  could not mint a token (${tokRes.status})`);
        failures += 1;
        continue;
    }

    const ih = {
        Authorization: `Bearer ${tok.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "prowler-check",
    };

    const probe = await fetch(`${api}/installation/repositories?per_page=1`, {
        headers: ih,
    });
    const accepted = probe.headers.get("x-accepted-github-permissions") ?? "";
    const permissionless = accepted.includes("allows_permissionless_access=true");
    const hasIssuesWrite = /\bissues:\s*write\b/.test(accepted);

    console.log(`    token header: ${accepted || "(empty)"}`);

    if (permissionless && !hasIssuesWrite) {
        console.log(
            "    FAIL  the installation token has NO permissions, so posting a PR comment will 403.",
        );
        console.log(
            "          Fix: uninstall the App at https://github.com/settings/installations",
        );
        console.log(
            "          then reinstall it so the new permissions are granted cleanly.",
        );
        failures += 1;
    } else if (!hasIssuesWrite) {
        console.log(
            "    WARN  issues:write is absent, so PR comments will 403 (reviews still save to the dashboard).",
        );
        failures += 1;
    } else {
        console.log("    OK    issues:write is granted, PR comments will post.");
    }
}

// ---- 2. the stored OAuth token behind the heatmap ---------------------------
const { db } = await import("../src/prisma/db.ts");
const accounts = await db.orm.auth.AuthAccount.all();
const account = accounts.find((a) => a.providerId === "github");

if (!account) {
    console.log("\nHeatmap: no GitHub account row - sign in with GitHub first.");
} else {
    const expired =
        account.accessTokenExpiresAt != null &&
        new Date(account.accessTokenExpiresAt).getTime() <= Date.now();

    if (!expired && account.accessToken) {
        console.log("\nHeatmap: token is valid.");
    } else if (!account.refreshToken) {
        console.log(
            "\nHeatmap: FAIL token expired and there is no refresh token - sign in with GitHub again.",
        );
        failures += 1;
    } else {
        const res = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
                client_id: process.env.GITHUB_APP_CLIENT_ID,
                client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
                grant_type: "refresh_token",
                refresh_token: account.refreshToken,
            }),
        });
        const payload = await res.json();

        if (payload.access_token) {
            console.log("\nHeatmap: token expired but refresh works - it will recover.");
        } else {
            console.log(
                `\nHeatmap: FAIL refresh token is dead (${payload.error ?? "unknown"}) - sign in with GitHub again.`,
            );
            failures += 1;
        }
    }
}

console.log(
    failures === 0
        ? "\nAll checks passed."
        : `\n${failures} check(s) need attention before a PR will review properly.`,
);

process.exit(failures === 0 ? 0 : 1);