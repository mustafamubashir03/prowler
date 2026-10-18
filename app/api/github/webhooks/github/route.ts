import { createHmac, timingSafeEqual } from "crypto";

import { db } from "@/src/prisma/db";
import { syncInstallation } from "@/features/auth/github/lib/sync-installation";
import { inngest } from "@/inngest/client";

function isValidSignature(body: string, signature: string) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!secret?.trim()) {
        throw new Error(
            "Missing required environment variable GITHUB_WEBHOOK_SECRET. Add it to .env and restart the dev server.",
        );
    }

    const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

    if (signature.length !== expected.length) return false;

    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(request: Request) {
    const body = await request.text();
    const signature = request.headers.get("x-hub-signature-256") ?? "";

    try {
        if (!isValidSignature(body, signature)) {
            return new Response("Invalid webhook signature", { status: 401 });
        }
    } catch (error) {
        return new Response(
            error instanceof Error ? error.message : "Webhook secret is not configured",
            { status: 500 },
        );
    }

    const event = request.headers.get("x-github-event");
    const payload = JSON.parse(body);
    const installationId = payload.installation?.id;

    if (!installationId) {
        return Response.json({ ok: true });
    }

    const githubInstallationId = Number(installationId);

    if (event === "installation" && payload.action === "deleted") {
        await db.orm.public.GitHubInstallation.where({
            githubInstallationId: String(githubInstallationId),
        }).deleteAll();
    }

    // GitHub's documented action type is "suspend", not "suspended". Matching
    // the latter meant this branch never ran and a suspended installation stayed
    // ACTIVE in the database, so reviews kept running against a revoked grant.
    if (event === "installation" && payload.action === "suspend") {
        await db.orm.public.GitHubInstallation.where({
            githubInstallationId: String(githubInstallationId),
        }).updateAll({ status: "SUSPENDED" });
    }

    if (
        (event === "installation" &&
            ["created", "unsuspend", "new_permissions_accepted"].includes(payload.action)) ||
        event === "installation_repositories"
    ) {
        await syncInstallation(githubInstallationId);
    }
    if (event === "pull_request") {
        const action = payload.action;

        if (["opened", "synchronize", "reopened"].includes(action)) {
            const headSha = payload.pull_request.head?.sha;

            await inngest.send({
                // GitHub redelivers webhooks. Keying on repo + PR + head sha means
                // a redelivery is a no-op, while a genuine new push still reviews.
                id: `pr-${payload.repository.id}-${payload.pull_request.number}-${
                    headSha ?? action
                }`,
                name: "pr/review.requested",
                data: {
                    installationId,
                    owner: payload.repository.owner.login,
                    repo: payload.repository.name,
                    prNumber: payload.pull_request.number,
                    prTitle: payload.pull_request.title,
                    prAuthor: payload.pull_request.user.login,
                    prUrl: payload.pull_request.html_url,
                    githubRepositoryId: String(payload.repository.id),
                    prBody: payload.pull_request.body ?? "",
                },
            });
        }
    }

    return Response.json({ ok: true });
}