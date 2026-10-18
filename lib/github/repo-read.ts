import { getInstallationOctokit } from "@/features/auth/github/lib/github-app";
import { db } from "@/src/prisma/db";
import { type Octokit } from "@octokit/rest";

/** Resolve the GitHub installation a Prowler repository row belongs to. */
export async function installationIdForRepository(installationRowId: string) {
    const installation = await db.orm.public.GitHubInstallation.where({
        id: installationRowId,
    }).first();

    return installation ? Number(installation.githubInstallationId) : null;
}

/** The commit the default branch points at. Pins listings to one revision. */
export async function resolveHeadSha(
    installationId: number,
    owner: string,
    repo: string,
    defaultBranch: string,
) {
    const octokit = (await getInstallationOctokit(installationId)) as Octokit;

    const { data: ref } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`,
    });

    return ref.object.sha;
}

/**
 * Files above this cannot be usefully rendered and are usually generated
 * bundles or data dumps, so they are reported rather than streamed.
 */
export const MAX_FILE_BYTES = 1024 * 1024;

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    mts: "typescript",
    cts: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    jsonc: "json",
    md: "markdown",
    mdx: "markdown",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    yml: "yaml",
    yaml: "yaml",
    toml: "ini",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    c: "c",
    h: "c",
    cpp: "cpp",
    hpp: "cpp",
    cs: "csharp",
    swift: "swift",
    prisma: "prisma",
};

export function languageFor(path: string) {
    const extension = path.split(".").pop()?.toLowerCase() ?? "";
    return LANGUAGE_BY_EXTENSION[extension] ?? "plaintext";
}

/**
 * A NUL byte in the decoded bytes is the standard heuristic for binary content.
 * Checking the string for a space instead would classify almost every text file
 * as binary.
 */
export function looksBinary(bytes: Buffer) {
    const limit = Math.min(bytes.byteLength, 8000);

    for (let i = 0; i < limit; i += 1) {
        if (bytes[i] === 0) return true;
    }

    return false;
}