import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";

import { auth } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";
import { db } from "@/src/prisma/db";
import { syncInstallation } from "@/features/auth/github/lib/sync-installation";
import { GITHUB_INSTALL_STATE_COOKIE } from "@/features/auth/github/lib/github-app";
import { AUTH_ROUTES } from "@/features/lib/routes";

function fail(message: string, status: number) {
    const response = new NextResponse(message, { status });
    response.cookies.delete(GITHUB_INSTALL_STATE_COOKIE);
    return response;
}

function readInstallationId(request: NextRequest) {
    const raw = request.nextUrl.searchParams.get("installation_id");
    return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}

function hasValidState(request: NextRequest) {
    const state = request.nextUrl.searchParams.get("state");
    const cookie = request.cookies.get(GITHUB_INSTALL_STATE_COOKIE)?.value;

    return Boolean(state) && state === cookie;
}

/** The user's GitHub user-to-server token, taken from their Better Auth account. */
async function getUserAccessToken(userId: string, request: NextRequest) {
    const account = await db.orm.auth.AuthAccount.where({
        userId,
        providerId: "github",
    }).first();

    if (!account) return null;

    const { accessToken } = await auth.api.getAccessToken({
        body: { accountId: account.id },
        headers: request.headers,
    });

    return accessToken || null;
}

/**
 * Never trust installation_id from the URL alone: confirm this user can actually
 * see the installation before we record it for them.
 */
async function userCanAccessInstallation(accessToken: string, installationId: number) {
    const octokit = new Octokit({ auth: accessToken });

    const installations = await octokit.paginate(
        octokit.rest.apps.listInstallationsForAuthenticatedUser,
        { per_page: 100 },
    );

    return installations.some((installation) => installation.id === installationId);
}

/**
 * A single log line for any failure, with nothing sensitive in it.
 *
 * Deliberately omits: error.message (driver and filesystem errors embed absolute
 * paths and connection detail), the access token, the app private key, and the
 * raw request URL. Keeps: the stage we died in, the error name, the HTTP status
 * when the failure came from the GitHub API, GitHub's own message, and the
 * database error code.
 */
function describeFailure(error: unknown, step: string) {
    const err = error as {
        name?: string;
        status?: number;
        response?: { data?: { message?: string } };
        code?: string;
    };

    return {
        step,
        name: error instanceof Error ? error.name : typeof error,
        status: typeof err?.status === "number" ? err.status : undefined,
        githubMessage:
            typeof err?.response?.data?.message === "string"
                ? err.response.data.message
                : undefined,
        dbCode: typeof err?.code === "string" ? err.code : undefined,
    };
}

/** Step 2 of the install flow: GitHub sends the user back here after installing. */
export async function GET(request: NextRequest) {
    let step = "params";

    try {
        const installationId = readInstallationId(request);

        if (installationId === null) {
            return fail("Missing or invalid installation_id", 400);
        }

        step = "session";
        const session = await auth.api.getSession({ headers: request.headers });

        if (!session) {
            return fail("Sign in before connecting a GitHub App", 401);
        }

        step = "state";
        if (!hasValidState(request)) {
            return fail("Invalid or expired install state", 403);
        }

        step = "account-lookup";
        const accessToken = await getUserAccessToken(session.user.id, request);

        if (!accessToken) {
            return fail("GitHub is not connected. Sign in with GitHub again.", 401);
        }

        step = "list-installations";
        const canAccess = await userCanAccessInstallation(accessToken, installationId);

        step = "ownership";
        if (!canAccess) {
            return fail("You do not have access to this GitHub App installation", 403);
        }

        step = "db-sync";
        await syncInstallation(installationId, session.user.id);

        step = "redirect";
        const success = NextResponse.redirect(appUrl(AUTH_ROUTES.home));
        success.cookies.delete(GITHUB_INSTALL_STATE_COOKIE);

        return success;
    } catch (error) {
        const detail = describeFailure(error, step);
        console.error("[github] install callback failed", detail);

        // In development, surface the stage so a failure is diagnosable from the
        // browser without reading server logs. Never in production.
        if (process.env.NODE_ENV !== "production") {
            return fail(`GitHub App installation failed (step: ${detail.step})`, 500);
        }

        return fail("GitHub App installation failed", 500);
    }
}