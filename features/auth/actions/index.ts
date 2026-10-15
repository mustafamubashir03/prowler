"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"


export async function signInWithGithub() {
    let url: string | undefined;

    try {
        const data = await auth.api.signInSocial({
            body: {
                provider: "github",
            },
            headers: await headers(),
        });

        url = data.url;
    } catch (err) {
        console.error(
            "[auth] sign-in social failed",
            err instanceof Error ? err.name : "unknown",
        );
        throw new Error("Could not start GitHub sign-in. Please try again.");
    }

    if (!url) {
        console.error("[auth] sign-in social returned no url");
        throw new Error("Could not start GitHub sign-in. Please try again.");
    }

    return redirect(url);
}

export async function signOut() {
    await auth.api.signOut({
        headers: await headers(),
    })
    return redirect("/sign-in")
}