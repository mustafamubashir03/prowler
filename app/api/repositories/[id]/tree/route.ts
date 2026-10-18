import { assertUserCanAccessRepository } from "@/lib/github/tenancy";
import {
    installationIdForRepository,
    resolveHeadSha,
} from "@/lib/github/repo-read";
import { getInstallationOctokit } from "@/features/auth/github/lib/github-app";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { type Octokit } from "@octokit/rest";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // `id` is GitHub's numeric repository id, which is what the dashboard links
    // carry and what survives a rename.
    const repository = await assertUserCanAccessRepository(
        session.user.id,
        (await params).id,
    );

    if (!repository) {
        return Response.json({ error: "Not found" }, { status: 404 });
    }

    const installationId = await installationIdForRepository(
        repository.installationId,
    );

    if (installationId === null) {
        return Response.json({ error: "Not found" }, { status: 404 });
    }

    try {
        const headSha = await resolveHeadSha(
            installationId,
            repository.owner,
            repository.name,
            repository.defaultBranch,
        );

        const octokit = (await getInstallationOctokit(
            installationId,
        )) as Octokit;

        const { data: tree } = await octokit.rest.git.getTree({
            owner: repository.owner,
            repo: repository.name,
            tree_sha: headSha,
            recursive: "true",
        });

        const files = tree.tree
            .filter((item) => item.type === "blob" && item.path)
            .map((item) => ({
                path: item.path,
                type: item.type,
                sha: item.sha,
                size: item.size ?? 0,
            }));

        return Response.json({
            headSha,
            truncated: tree.truncated ?? false,
            files,
        });
    } catch (error) {
        console.error(
            "[code] tree fetch failed",
            error instanceof Error ? error.name : typeof error,
        );
        return Response.json(
            { error: "Could not read the repository tree" },
            { status: 502 },
        );
    }
}