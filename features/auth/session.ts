import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"

/**
 * Session reads. These are NOT server actions: a "use server" module turns every
 * export into an action, which can only be invoked from an event handler, not
 * during render. Keep these in a plain server module and put mutations in
 * features/auth/actions instead.
 */
export async function getSession() {
    return auth.api.getSession({
        headers: await headers(),
    })
}

export async function getCurrentUser() {
    const session = await getSession()
    return session?.user ?? null
}

export async function requireAuth() {
    const session = await getSession()
    if (!session) {
        return redirect("/sign-in")
    }
    return session
}

export async function requireUnAuth() {
    const session = await getSession()
    if (session) {
        return redirect("/")
    }
}