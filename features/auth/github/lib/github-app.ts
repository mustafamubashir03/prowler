import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";

/** Cookie that ties a GitHub App install redirect back to the user who started it. */
export const GITHUB_INSTALL_STATE_COOKIE = "github_install_state";

/** 10 minutes is plenty to walk through GitHub's install screens. */
export const GITHUB_INSTALL_STATE_TTL = 60 * 10;

export function requiredEnv(name: string): string {
    const value = process.env[name];

    if (!value?.trim()) {
        throw new Error(
            `Missing required environment variable ${name}. Add it to .env and restart the dev server.`,
        );
    }

    return value;
}

/** The app's URL slug, e.g. "prowler" for github.com/apps/prowler. */
export function getGithubAppSlug(): string {
    return requiredEnv("GITHUB_APP_SLUG");
}

let app: App | undefined;

/**
 * The PEM is supplied through the environment. It arrives either fully expanded
 * (real newlines) or as one line with escaped "\n" sequences, depending on how
 * the shell and dotenv handle it, so both forms are accepted.
 */
function readPrivateKey(): string {
    const raw = requiredEnv("GITHUB_APP_PRIVATE_KEY");

    const key = raw
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/\\n/g, "\n")
        .trim();

    if (!key.includes("BEGIN") || !key.includes("PRIVATE KEY")) {
        throw new Error(
            "GITHUB_APP_PRIVATE_KEY does not contain a PEM private key. " +
                "Paste the full key from your GitHub App's .pem file.",
        );
    }

    return key;
}

/**
 * Built lazily so a missing GITHUB_APP_PRIVATE_KEY only breaks the GitHub
 * routes instead of crashing the whole app on import.
 */
export function getGithubApp(): App {
    if (app) return app;

    app = new App({
        appId: Number(requiredEnv("GITHUB_APP_ID")),
        privateKey: readPrivateKey(),
        Octokit,
        webhooks: {
            secret: requiredEnv("GITHUB_WEBHOOK_SECRET"),
        },
    });

    return app;
}

export async function getInstallationOctokit(installationId: number) {
    return getGithubApp().getInstallationOctokit(installationId);
}