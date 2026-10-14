import { requireUnAuth } from "@/features/auth/session";
import { GithubSignInButton } from "@/features/auth/components/github-sign-in-button";

// This route reads the session cookie, which is a request read and cannot be
// prerendered into the static shell. Allow it to block on the server.
export const instant = false;

export default async function SignInPage() {
    await requireUnAuth();
    return (
        <div className="space-y-6">
            <div className="space-y-2 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">Sign In</h1>
                <p className="text-muted-foreground">
                    Choose a method to sign in
                </p>
            </div>
            <GithubSignInButton />
        </div>
    )
}