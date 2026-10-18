import { db } from "@/src/prisma/db";
import { inngest } from "./client";
import { getInstallationOctokit } from "@/features/auth/github/lib/github-app";
import { Octokit } from "@octokit/rest";
import { embedTexts } from "@/lib/embeddings";
import {
    deleteVectorsById,
    index,
    listVectorIds,
    repositoryVectorPrefix,
} from "@/lib/pinecone";

const CODE_EXTENSIONS = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".cjs",
    ".mjs",
    ".py",
    ".rb",
    ".php",
    ".go",
    ".rs",
    ".java",
    ".kt",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".swift",
    ".sh",
    ".bash",
    ".zsh",
    ".fish",
    ".json",
    ".jsonc",
    ".yaml",
    ".yml",
    ".md",
    ".mdx",
    ".html",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".styl",
    ".vue",
    ".svelte",
    ".sql",
    ".prisma",
    ".toml",
]

const SKIP_DIRS = ["node_modules", ".next", "dist", "build", ".git", ".github", ".vercel", "out", "public", "coverage", "vendor", "target"]

const SKIP_FILES = ["yarn.lock", "pnpm-lock.yaml", "package-lock.json", "bun.lockb"]

function chunkText(text: string) {
    const chunkSize = 2000;
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
}

function shouldSkipPath(path: string) {
    const segments = path.split("/");
    if (SKIP_DIRS.some((dir) => segments.includes(dir))) return true;
    return SKIP_FILES.includes(path);
}

async function setIndexStatus(
    repositoryId: string,
    indexStatus: string,
    options: { indexedAt?: string | null; indexError?: string | null } = {},
) {
    await db.orm.public.GitHubRepository.where({
        id: repositoryId,
    }).update({
        indexStatus,
        ...(options.indexedAt === undefined ? {} : { indexedAt: options.indexedAt }),
        ...(options.indexError === undefined ? {} : { indexError: options.indexError }),
    });
}

export const indexRepository = inngest.createFunction(
    {
        id: "index-repository",
        name: "Index Repository",
        triggers: [
            {
                event: "repo/index.requested",
            },
        ],
        onFailure: async ({ event, error }) => {
            const repositoryId = (event.data as { repositoryId?: string } | undefined)?.repositoryId;
            if (!repositoryId) return;

            try {
                // indexedAt is deliberately left alone: a failed re-index must not
                // erase the record that a previous run succeeded.
                await setIndexStatus(repositoryId, "FAILED", {
                    indexError: error?.message ?? "Indexing failed",
                });
            } catch {
                // The original failure is already reported; never mask it here.
            }
        },
    },
    async function ({ event, step }) {
        const repositoryId = (event.data as { repositoryId?: string }).repositoryId;

        if (!repositoryId) {
            throw new Error("repo/index.requested is missing repositoryId");
        }

        await step.run("mark-indexing", async () => {
            // The previous index is still valid and still serving retrieval until
            // this run finishes, so indexedAt is kept and any prior error cleared.
            await setIndexStatus(repositoryId, "INDEXING", { indexError: null });
        });

        const repo = await step.run("load-repository", async () => {
            const repository = await db.orm.public.GitHubRepository.where({
                id: repositoryId,
            }).first();

            if (!repository) return null;

            const installation = await db.orm.public.GitHubInstallation.where({
                id: repository.installationId,
            }).first();

            if (!installation) return null;

            return { repository, installation };
        });

        if (!repo) throw new Error("Repo not found");

        // Nothing below touches Pinecone until every file has been fetched,
        // chunked and embedded. The previous index stays intact and serving
        // retrieval for the whole of that phase, so a GitHub or embedding failure
        // part way through costs nothing but a FAILED status.
        const files = await step.run("fetch-files", async () => {
            const installationOctokit = (await getInstallationOctokit(
                Number(repo.installation.githubInstallationId),
            )) as Octokit;

            const { data: ref } = await installationOctokit.rest.git.getRef({
                owner: repo.repository.owner,
                repo: repo.repository.name,
                ref: `heads/${repo.repository.defaultBranch}`,
            });

            const { data: tree } = await installationOctokit.rest.git.getTree({
                owner: repo.repository.owner,
                repo: repo.repository.name,
                tree_sha: ref.object.sha,
                recursive: "true",
            });

            return tree.tree.filter((item) =>
                item.type === "blob" &&
                item.path &&
                !shouldSkipPath(item.path) &&
                CODE_EXTENSIONS.some((ext) => item.path.endsWith(ext)) &&
                (item.size ?? 0) < 100_000,
            );
        });

        const batchSize = 20;

        // Phase 1: fetch and chunk every file, writing nothing. The batch loop
        // stays, because Inngest replays step-by-step and re-reading every file
        // on each retry would be unbounded work.
        const batches: { path: string; content: string }[][] = [];

        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);

            const contents = await step.run(`read-batch-${i / batchSize}`, async () => {
                const installationOctokit = (await getInstallationOctokit(
                    Number(repo.installation.githubInstallationId),
                )) as Octokit;

                const fileContents = await Promise.all(
                    batch.map(async (file) => {
                        const { data } = await installationOctokit.rest.repos.getContent({
                            owner: repo.repository.owner,
                            repo: repo.repository.name,
                            path: file.path!,
                        });

                        if (Array.isArray(data) || data.type !== "file") {
                            return null;
                        }

                        return {
                            path: file.path!,
                            content: Buffer.from(data.content, "base64").toString("utf-8"),
                        };
                    }),
                );

                return fileContents.filter((file): file is { path: string; content: string } =>
                    file !== null,
                );
            });

            batches.push(contents);
        }

        // Phase 2: everything is read, so the write phase cannot be interrupted
        // by GitHub. Chunk ids stay {repositoryId}:{path}:{chunkIndex}, which is
        // what makes a re-index idempotent: the same tree produces the same ids
        // and upserts over itself.
        const records: {
            id: string;
            values: number[];
            metadata: Record<string, string | number>;
        }[] = [];

        for (let i = 0; i < batches.length; i++) {
            const batchRecords = await step.run(`embed-batch-${i}`, async () => {
                const allChunks: { path: string; chunk: string; chunkIndex: number }[] = [];

                for (const file of batches[i]) {
                    chunkText(file.content).forEach((chunk, chunkIndex) => {
                        allChunks.push({ path: file.path, chunk, chunkIndex });
                    });
                }

                if (allChunks.length === 0) return [];

                const embeddings = await embedTexts(allChunks.map((chunk) => chunk.chunk));

                return allChunks.map((item, position) => ({
                    id: `${repositoryId}:${item.path}:${item.chunkIndex}`,
                    values: embeddings.data[position].embedding,
                    metadata: {
                        repositoryId,
                        fullName: repo.repository.fullName,
                        path: item.path,
                        chunkIndex: item.chunkIndex,
                        content: item.chunk.slice(0, 1000),
                    },
                }));
            });

            records.push(...batchRecords);
        }

        // Upsert first, prune second. Deleting the stale set before the new
        // chunks are in would, on a failure, leave the repository with neither.
        await step.run("upsert-chunks", async () => {
            const writeBatch = 100;

            for (let i = 0; i < records.length; i += writeBatch) {
                await index().upsert({ records: records.slice(i, i + writeBatch) });
            }
        });

        // Only ids under this repository's prefix that are absent from the new
        // set get deleted: chunks of deleted files, and the high chunk indexes
        // of files that shrank. Everything else is left exactly as it was.
        const pruned = await step.run("prune-stale-chunks", async () => {
            const keep = new Set(records.map((record) => record.id));
            const existing = await listVectorIds(repositoryVectorPrefix(repositoryId));
            const stale = existing.filter((id) => !keep.has(id));

            if (stale.length > 0) {
                await deleteVectorsById(stale);
            }

            return stale.length;
        });

        await step.run("mark-indexed", async () => {
            await setIndexStatus(repositoryId, "INDEXED", {
                indexedAt: new Date().toISOString(),
                indexError: null,
            });
        });

        return {
            repositoryId,
            fullName: repo.repository.fullName,
            files: files.length,
            chunks: records.length,
            pruned,
        };
    },
)
