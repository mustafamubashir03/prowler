import { requireRepositoryAccess } from "@/lib/github/guard";
import {
    installationIdForRepository,
    languageFor,
    looksBinary,
    MAX_FILE_BYTES,
    resolveHeadSha,
} from "@/lib/github/repo-read";
import { getInstallationOctokit } from "@/features/auth/github/lib/github-app";
import { type Octokit } from "@octokit/rest";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const path = searchParams.get("path");
    const sha = searchParams.get("sha");

    if (!id || !path) {
        return Response.json(
            { error: "id and path are required" },
            { status: 400 },
        );
    }

    const access = await requireRepositoryAccess(id);

    if ("response" in access) return access.response;

    const repository = access.repository;

    const installationId = await installationIdForRepository(
        repository.installationId,
    );

    if (installationId === null) {
        return Response.json({ error: "Not found" }, { status: 404 });
    }

    try {
        const language = languageFor(path);

        // A supplied sha pins the read to the commit the tree was taken from,
        // so the editor cannot show content that disagrees with the file list.
        const resolvedSha =
            sha ??
            (await resolveHeadSha(
                installationId,
                repository.owner,
                repository.name,
                repository.defaultBranch,
            ));

        const octokit = (await getInstallationOctokit(
            installationId,
        )) as Octokit;

        const { data } = await octokit.rest.git.getBlob({
            owner: repository.owner,
            repo: repository.name,
            file_sha: resolvedSha,
            path,
        });

        const bytes = Buffer.from(data.content ?? "", "base64");
        const size = bytes.byteLength;

        if (size > MAX_FILE_BYTES) {
            return Response.json({
                binary: false,
                tooLarge: true,
                size,
                maxBytes: MAX_FILE_BYTES,
                path,
                sha: resolvedSha,
                language,
                content: "",
                lines: 0,
            });
        }

        const binary = looksBinary(bytes);
        const content = binary ? "" : bytes.toString("utf-8");

        return Response.json({
            binary,
            tooLarge: false,
            size,
            path,
            sha: resolvedSha,
            language,
            content,
            lines: binary ? 0 : content.split("\n").length,
        });
    } catch (error) {
        console.error(
            "[code] file fetch failed",
            error instanceof Error ? error.name : typeof error,
        );
        return Response.json(
            { error: "Could not read the file" },
            { status: 502 },
        );
    }
}