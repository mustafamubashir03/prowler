import { Octokit } from "@octokit/rest";

import { getInstallationOctokit } from "@/features/auth/github/lib/github-app";
import { generatePRReview } from "@/lib/agent-review";
import { embedTexts } from "@/lib/embeddings";
import { index } from "@/lib/pinecone";
import { db } from "@/src/prisma/db";
import { inngest } from "./client";

export const reviewPullRequest = inngest.createFunction(
    {
        id: "review-pull-request",
        name: "Review Pull Request",
        triggers: [
            {
                event: "pr/review.requested",
            },
        ],
        onFailure: async ({ event }) => {
            const data = event.data as {
                githubRepositoryId?: string;
                prNumber?: number;
            };

            if (!data?.githubRepositoryId || !data?.prNumber) return;

            try {
                const review = await db.orm.public.PullRequestReview.where({
                    githubRepositoryId: data.githubRepositoryId,
                    githubPrNumber: data.prNumber,
                }).first();

                // The review may already be stored: a later step failing (or the
                // comment permission being absent) must not mark it failed.
                if (!review || review.status === "COMPLETED") return;

                await db.orm.public.PullRequestReview.where({
                    id: review.id,
                }).update({ status: "FAILED" });
            } catch {
                // The original failure is already reported; never mask it here.
            }
        },
    },
    async ({ event, step }) => {
        const {
            installationId,
            owner,
            repo,
            prNumber,
            prTitle,
            prAuthor,
            prUrl,
            githubRepositoryId,
            prBody,
        } = event.data as {
            installationId: number;
            owner: string;
            repo: string;
            prNumber: number;
            prTitle: string;
            prAuthor: string;
            prUrl: string;
            githubRepositoryId: string;
            prBody?: string | null;
        };

        const reviewRecord = await step.run("create-review-record", async () => {
            // The webhook carries GitHub's repository id; resolve the Prowler row
            // so reviews stay linked to the indexed repository.
            const repository = await db.orm.public.GitHubRepository.where({
                githubRepositoryId,
            }).first();

            return db.orm.public.PullRequestReview.upsert({
                conflictOn: {
                    githubRepositoryId,
                    githubPrNumber: prNumber,
                },
                create: {
                    githubPrNumber: prNumber,
                    githubRepositoryId,
                    repositoryId: repository?.id,
                    owner,
                    repoName: repo,
                    fullName: `${owner}/${repo}`,
                    title: prTitle,
                    author: prAuthor,
                    prUrl,
                    status: "REVIEWING",
                },
                update: {
                    title: prTitle,
                    author: prAuthor,
                    prUrl,
                    status: "REVIEWING",
                    reviewBody: null,
                },
            });
        });

        const pr = await step.run("fetch-pr-diff", async () => {
            const octokit = (await getInstallationOctokit(
                installationId,
            )) as Octokit;

            const { data: files } = await octokit.rest.pulls.listFiles({
                owner,
                repo,
                pull_number: prNumber,
                per_page: 100,
            });

            const fileList = files
                .map(
                    (file) =>
                        `${file.filename} [${file.status} ${file.additions} additions, ${file.deletions} deletions]`,
                )
                .join(`\n`);

            const diff = files
                .map((file) => {
                    const patch =
                        file.patch?.slice(0, 3000) ??
                        "(no text diff: binary or too large)";
                    return `--- ${file.filename} [${file.status}]\n\n${patch}`;
                })
                .join(`\n\n`)
                .slice(0, 24000);

            return { fileList, diff };
        });

        const codebaseContext = await step.run("fetch-code-context", async () => {
            // Without a linked repository row there is nothing to scope the
            // search to. Filtering on a null repositoryId would either error or
            // silently match nothing, so degrade to a diff-only review instead.
            if (!reviewRecord.repositoryId) return "";

            const [embedding] = (await embedTexts([pr.diff.slice(0, 6000)]))
                .data;

            const results = await index.query({
                vector: embedding.embedding,
                topK: 8,
                includeMetadata: true,
                filter: {
                    repositoryId: reviewRecord.repositoryId,
                },
            });

            return results.matches
                .map(
                    (match) =>
                        `--- ${match.metadata?.path} ----\n ${match.metadata?.content}`,
                )
                .join(`\n\n`);
        });

        const reviewBody = await step.run("generate-review-body", async () =>
            generatePRReview({
                title: prTitle,
                body: prBody ?? "",
                author: prAuthor,
                files: pr.fileList,
                diff: pr.diff,
                codebaseContext,
            }),
        );

        // generatePRReview reports failure as a string. Without this guard the
        // failure text would be posted as a review comment and stored as
        // COMPLETED, so a failed run would look like a successful one.
        if (reviewBody.startsWith("Review could not be generated")) {
            throw new Error(reviewBody);
        }

        // Persist before posting. Posting needs the App to hold a write
        // permission it may not have, and a throw there would otherwise discard a
        // review that was already generated and paid for.
        await step.run("save-review", async () => {
            await db.orm.public.PullRequestReview.where({
                id: reviewRecord.id,
            }).update({
                reviewBody,
                status: "COMPLETED",
            });
        });

        await step.run("post-github-comment", async () => {
            const octokit = (await getInstallationOctokit(
                installationId,
            )) as Octokit;

            try {
                await octokit.rest.issues.createComment({
                    owner,
                    repo,
                    issue_number: prNumber,
                    body: `## Prowler Review\n\n${reviewBody}\n\n---\n<sub>Generated by Prowler</sub>`,
                });
            } catch (error) {
                const status =
                    error && typeof error === "object" && "status" in error
                        ? (error as { status?: number }).status
                        : undefined;

                // The review is already stored, so this must not fail the run.
                // A 404/403 here is almost always the App lacking the Issues
                // write permission.
                console.error(
                    `[review] PR comment not posted (${status ?? "unknown"}); the review is still saved on the dashboard`,
                );
            }
        });

        return {
            prNumber,
            fullName: `${owner}/${repo}`,
            reviewId: reviewRecord.id,
        };
    },
);
