"use client"

import { Button } from "@/components/ui/button"
import { signOut } from "../actions"

export function SignOutButton() {
    return (
        <form action={signOut}>
            <Button
                size="sm"
                variant="ghost"
                className="rounded-none font-mono text-xs uppercase tracking-[0.12em]"
                type="submit"
            >
                Sign out
            </Button>
        </form>
    );
}