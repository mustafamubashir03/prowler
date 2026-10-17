import { db } from "@/src/prisma/db";
import { inngest } from "./client";
import { getInstallationOctokit } from "@/features/auth/github/lib/github-app";
import { Octokit } from "@octokit/rest";
import { embedTexts } from "@/lib/embeddings";
import { index } from "@/lib/pinecone";

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
    indexedAt?: string | null,
) {
    await db.orm.public.GitHubRepository.where({
        id: repositoryId,
    }).update({
        indexStatus,
        ...(indexedAt === undefined ? {} : { indexedAt }),
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
        onFailure: async ({ event }) => {
            const repositoryId = (event.data as { repositoryId?: string } | undefined)?.repositoryId;
            if (!repositoryId) return;

            try {
                await setIndexStatus(repositoryId, "FAILED");
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
            await setIndexStatus(repositoryId, "INDEXING", null);
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

        // Upsert alone leaves vectors behind: chunks for deleted files, and the
        // high chunk indexes of files that shrank, would survive every re-index
        // and skew retrieval. Clearing first keeps the namespace honest.
        await step.run("clear-existing-vectors", async () => {
            await index.deleteMany({ filter: { repositoryId } });
        });

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

        let indexedChunks = 0;
        const batchSize = 20;

        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);

            const chunksIndexed = await step.run(`index-batch-${i / batchSize}`, async () => {
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

                const allChunks: { path: string, chunk: string, chunkIndex: number }[] = [];

                for (const file of fileContents) {
                    if (!file) continue;
                    const chunks = chunkText(file.content);
                    chunks.forEach((chunk, chunkIndex) => {
                        allChunks.push({
                            path: file.path,
                            chunk,
                            chunkIndex,
                        });
                    });
                }

                if (allChunks.length === 0) return 0;

                const embeddings = await embedTexts(allChunks.map((chunk) => chunk.chunk));

                const records = allChunks.map((item, position) => ({
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

                await index.upsert({ records });

                return allChunks.length;
            });

            indexedChunks += chunksIndexed;
        }

        await step.run("mark-indexed", async () => {
            await setIndexStatus(repositoryId, "INDEXED", new Date().toISOString());
        });

        return {
            repositoryId,
            fullName: repo.repository.fullName,
            files: files.length,
            chunks: indexedChunks,
        };
    },
)
