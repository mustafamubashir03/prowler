import { requireRepositoryAccess } from "@/lib/github/guard";
import {
    installationIdForRepository,
    resolveHeadSha,
} from "@/lib/github/repo-read";
import { getInstallationOctokit } from "@/features/auth/github/lib/github-app";
import { type Octokit } from "@octokit/rest";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    // One guard for every repository route: 401 signed out, 404 not yours.
    const access = await requireRepositoryAccess((await params).id);

    if ("response" in access) return access.response;

    const repository = access.repository;

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