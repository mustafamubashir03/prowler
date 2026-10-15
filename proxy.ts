import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "./lib/auth";
import { AUTH_ROUTES, GUEST_ONLY_ROUTES, PROTECTED_ROUTES } from "./features/lib/routes";

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl
    const session = await auth.api.getSession({
        headers: await headers()
    })
    const isProtected = PROTECTED_ROUTES.includes(pathname)
    const isGuestOnly = GUEST_ONLY_ROUTES.includes(pathname)

    if (isProtected && !session) {
        return NextResponse.redirect(new URL(AUTH_ROUTES.signIn, request.url))
    }

    if (isGuestOnly && session) {
        return NextResponse.redirect(new URL(AUTH_ROUTES.home, request.url))
    }


}

// Matcher entries must be static strings, so these are written out literally
// rather than read from AUTH_ROUTES.
export const config = {
    matcher: ["/dashboard", "/sign-in"]
}