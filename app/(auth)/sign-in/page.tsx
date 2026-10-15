import { requireUnAuth } from "@/features/auth/session";
import { GithubSignInButton } from "@/features/auth/components/github-sign-in-button";

// This route reads the session cookie, which is a request read and cannot be
// prerendered into the static shell. Allow it to block on the server.
export const instant = false;

export default async function SignInPage() {
    await requireUnAuth();

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
                <p className="text-sm text-muted-foreground">
                    Prowler uses your GitHub account to install the app on your
                    repositories.
                </p>
            </div>
            <GithubSignInButton />
        </div>
    );
}