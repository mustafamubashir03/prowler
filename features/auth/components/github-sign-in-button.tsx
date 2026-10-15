"use client"

import { Button } from "@/components/ui/button"
import { signInWithGithub } from "../actions"

export function GithubSignInButton() {
    return (
        <form action={signInWithGithub}>
            <Button size="lg" className="w-full rounded-none" type="submit">
                Continue with GitHub
            </Button>
        </form>
    );
}