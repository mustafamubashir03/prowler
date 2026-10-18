/**
 * Chat grounding.
 *
 * Three read-only tools over the App's installation token and its vector
 * store. There is no sandbox and no checkout: every read goes through GitHub's
 * API, which also means the App never needs write access for chat.
 *
 * Repository content is untrusted. A file can contain text that reads like an
 * instruction, and the system prompt says so explicitly, but the tools here also
 * treat content as inert: it is returned to the model as data, never executed,
 * never used to build a path, and never used to widen a search beyond the
 * repository the caller already proved they own.
 */

import { getInstallationOctokit } from "@/features/auth/github/lib/github-app";
import { index } from "@/lib/pinecone";
import { embedTexts } from "@/lib/embeddings";
import {
    installationIdForRepository,
    languageFor,
    looksBinary,
    MAX_FILE_BYTES,
    resolveHeadSha,
} from "@/lib/github/repo-read";
import { type Octokit } from "@octokit/rest";

/** Enough lines around a hit to judge it, without flooding the context. */
const READ_WINDOW_LINES = 400;

export type RepoToolContext = {
    installationId: number;
    owner: string;
    repo: string;
    defaultBranch: string;
    /**
     * The namespace every tool is confined to. On main the chunk ids are keyed
     * on the local repository id, so this is the row id, not the GitHub id.
     */
    namespace: string;
};

type RepoTool =
    | {
          name: "read_file";
          description: string;
          input: { path: string };
          run: (input: { path: string }) => Promise<string>;
      }
    | {
          name: "list_files";
          description: string;
          input: { prefix?: string };
          run: (input: { prefix?: string }) => Promise<string>;
      }
    | {
          name: "semantic_search";
          description: string;
          input: { query: string };
          run: (input: { query: string }) => Promise<string>;
      };

/**
 * Reject anything that could walk out of the repository: absolute paths, `..`
 * segments, NUL bytes and empty names all resolve to nothing rather than being
 * cleaned up, because silently rewriting a path would hide a malformed request.
 */
function safePath(path: string) {
    if (typeof path !== "string") return null;
    if (path.length === 0 || path.length > 1024) return null;
    if (path.includes("\0")) return null;
    if (path.startsWith("/") || path.startsWith("\\")) return null;
    if (/^[a-zA-Z]:/.test(path)) return null;

    const segments = path.split("/");

    if (segments.some((segment) => segment === ".." || segment === "")) {
        return null;
    }

    return segments.join("/");
}

export function repoTools(context: RepoToolContext): RepoTool[] {
    async function octokit() {
        return (await getInstallationOctokit(
            context.installationId,
        )) as Octokit;
    }

    const readFile: RepoTool = {
        name: "read_file",
        description:
            "Read one file from the repository at the default branch head. Returns the content with 1-based line numbers prefixed as `N| `.",
        input: { path: "" },
        run: async ({ path }) => {
            const target = safePath(path);

            if (!target) {
                return `Refused: "${path}" is not a plain path inside the repository.`;
            }

            const sha = await resolveHeadSha(
                context.installationId,
                context.owner,
                context.repo,
                context.defaultBranch,
            );

            const { data } = await (await octokit()).rest.git.getBlob({
                owner: context.owner,
                repo: context.repo,
                file_sha: sha,
                path: target,
            });

            const bytes = Buffer.from(data.content ?? "", "base64");

            if (bytes.byteLength > MAX_FILE_BYTES) {
                return `Refused: ${target} is ${bytes.byteLength} bytes, over the ${MAX_FILE_BYTES} byte read limit.`;
            }

            if (looksBinary(bytes)) {
                return `Refused: ${target} is binary.`;
            }

            const lines = bytes.toString("utf-8").split("\n");

            if (lines.length > READ_WINDOW_LINES) {
                return [
                    `${target} (${languageFor(target)}) has ${lines.length} lines. Showing the first ${READ_WINDOW_LINES}.`,
                    "",
                    ...lines
                        .slice(0, READ_WINDOW_LINES)
                        .map((line, index) => `${index + 1}| ${line}`),
                ].join("\n");
            }

            return [
                `${target} (${languageFor(target)})`,
                "",
                ...lines.map((line, index) => `${index + 1}| ${line}`),
            ].join("\n");
        },
    };

    const listFiles: RepoTool = {
        name: "list_files",
        description:
            "List file paths in the repository, optionally filtered to a directory prefix. Returns one path per line, relative to the repository root.",
        input: { prefix: "" },
        run: async ({ prefix }) => {
            const sha = await resolveHeadSha(
                context.installationId,
                context.owner,
                context.repo,
                context.defaultBranch,
            );

            const { data: tree } = await (
                await octokit()
            ).rest.git.getTree({
                owner: context.owner,
                repo: context.repo,
                tree_sha: sha,
                recursive: "true",
            });

            const needle = prefix ? safePath(prefix) : null;

            if (prefix && !needle) {
                return `Refused: "${prefix}" is not a plain directory prefix.`;
            }

            const files = tree.tree
                .filter((item) => item.type === "blob" && item.path)
                .map((item) => item.path as string)
                .filter((item) => !needle || item.startsWith(`${needle}/`));

            if (files.length === 0) {
                return "No files matched.";
            }

            const capped = files.slice(0, 800);

            return [
                ...capped,
                files.length > capped.length
                    ? `...and ${files.length - capped.length} more.`
                    : null,
            ]
                .filter(Boolean)
                .join("\n");
        },
    };

    const semanticSearch: RepoTool = {
        name: "semantic_search",
        description:
            "Search the indexed contents of this repository by meaning. Use it when you do not know the file name. Returns matching paths with a short excerpt.",
        input: { query: "" },
        run: async ({ query }) => {
            if (!query || query.trim().length === 0) {
                return "Refused: empty query.";
            }

            const [embedding] = (await embedTexts([query.slice(0, 4000)])).data;

            const results = await index().query({
                vector: embedding.embedding,
                topK: 8,
                includeMetadata: true,
                filter: { repositoryId: context.namespace },
            });

            if (results.matches.length === 0) {
                return "No matches. The repository may not be indexed yet.";
            }

            return results.matches
                .map((match, index) => {
                    const path = match.metadata?.path ?? "(unknown)";
                    const excerpt = String(match.metadata?.content ?? "").slice(
                        0,
                        400,
                    );

                    return [
                        `${index + 1}. ${path}`,
                        excerpt.replace(/\n/g, " ").slice(0, 300),
                    ].join("\n");
                })
                .join("\n\n");
        },
    };

    return [readFile, listFiles, semanticSearch];
}

export function toolContextForRepository(
    repository: {
        id: string;
        installationId: string;
        owner: string;
        name: string;
        defaultBranch: string;
    },
): Promise<RepoToolContext> {
    return installationIdForRepository(repository.installationId).then(
        (installationId) => ({
            installationId: installationId ?? 0,
            owner: repository.owner,
            repo: repository.name,
            defaultBranch: repository.defaultBranch,
            namespace: repository.id,
        }),
    );
}