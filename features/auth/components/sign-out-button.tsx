"use client"

import { Button } from "@/components/ui/button"
import { signOut } from "../actions"

export function SignOutButton() {
    return (
        <form action={signOut}>
            <Button size={"lg"} className={"w-full"} type="submit">Sign Out</Button>
        </form>
    )
}