"use client"


import { Button } from "@/components/ui/button"
import { signInWithGithub } from "../actions"

export function GithubSignInButton() {
    return (
        <form action={signInWithGithub}>
            <Button size={"lg"} className={"w-full"} type="submit">Sign In with GitHub</Button>
        </form>
    )
}