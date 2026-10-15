import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";
import {
    GITHUB_INSTALL_STATE_COOKIE,
    GITHUB_INSTALL_STATE_TTL,
    getGithubAppSlug,
} from "@/features/auth/github/lib/github-app";
import { AUTH_ROUTES } from "@/features/lib/routes";

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: request.headers,
    });

    if (!session) {
        return NextResponse.redirect(appUrl(AUTH_ROUTES.signIn));
    }

    const state = randomUUID();
    const installUrl = new URL(
        `https://github.com/apps/${getGithubAppSlug()}/installations/new`,
    );
    installUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(installUrl);
    response.cookies.set(GITHUB_INSTALL_STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: GITHUB_INSTALL_STATE_TTL,
        secure: process.env.NODE_ENV === "production",
    });

    return response;
}