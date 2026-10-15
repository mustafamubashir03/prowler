export const AUTH_ROUTES = {
    signIn: "/sign-in",
    landing: "/",
    home: "/dashboard",
    dashboard: "/dashboard",
}

export const GITHUB_ROUTES = {
    install: "/api/github/install",
    callback: "/api/github/callback"
}

export const PROTECTED_ROUTES = [AUTH_ROUTES.dashboard]
export const GUEST_ONLY_ROUTES = [AUTH_ROUTES.signIn]