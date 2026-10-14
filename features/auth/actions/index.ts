"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"


export async function signInWithGithub() {
    const data = await auth.api.signInSocial({
        body: {
            provider: "github"
        }
    })


    return redirect(data.url!)
}

export async function signOut() {
    await auth.api.signOut({
        headers: await headers(),
    })
    return redirect("/sign-in")
}