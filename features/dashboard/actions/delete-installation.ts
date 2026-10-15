"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { db } from "@/src/prisma/db"
import { AUTH_ROUTES } from "@/features/lib/routes"
import { getGithubApp } from "../../auth/github/lib/github-app"

export async function deleteInstallation(installationId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session) throw new Error("User not authenticated")

    // Scope the lookup to the caller so one user can never uninstall another's.
    const installation = await db.orm.public.GitHubInstallation.where({
        userId: session.user.id,
        githubInstallationId: String(installationId)
    }).first()
    if (!installation) throw new Error("Installation not found")

    try {
        await getGithubApp().octokit.request("DELETE /app/installations/{installation_id}", {
            installation_id: Number(installation.githubInstallationId)
        })
    } catch (error) {
        // 404 means GitHub already considers it uninstalled, so the local row
        // can still be removed. Anything else is rethrown so the local row is
        // never deleted while GitHub still holds the installation.
        const status =
            error && typeof error === "object" && "status" in error
                ? (error as { status?: number }).status
                : undefined

        if (status !== 404) throw error
    }

    try {
        await db.orm.public.GitHubInstallation.where({
            githubInstallationId: String(installation.githubInstallationId)
        }).delete()
    } catch {
        // GitHub has already dropped the installation, so the grant is gone
        // either way. Log only the fact, never driver text or paths.
        console.error("[github] uninstall removed the GitHub installation but the local row was not deleted")
        throw new Error("Uninstalled on GitHub, but could not clean up local data")
    }

    revalidatePath(AUTH_ROUTES.home)
}