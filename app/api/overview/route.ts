import { auth } from "@/lib/auth";
import { db } from "@/src/prisma/db";
import { headers } from "next/headers";

export async function GET() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const installations = await db.orm.public.GitHubInstallation.where({
        userId: session.user.id,
    }).all();

    const installationIds = installations.map((installation) => installation.id);

    if (installationIds.length === 0) {
        return Response.json({
            stats: {
                installations: 0,
                repositories: 0,
                indexedRepositories: 0,
                indexingRepositories: 0,
                failedRepositories: 0,
                pullRequestReviews: 0,
                completedReviews: 0,
            },
            recentReviews: [],
            recentRepositories: [],
        });
    }

    const repositories = await db.orm.public.GitHubRepository.where((fields) =>
        fields.installationId.in(installationIds),
    ).all();

    const repositoryIds = repositories.map((repository) => repository.id);

    const reviews =
        repositoryIds.length === 0
            ? []
            : await db.orm.public.PullRequestReview.where((fields) =>
                  fields.repositoryId.in(repositoryIds),
              )
                  .orderBy((fields) => fields.updatedAt.desc())
                  .all();

    const byNewest = (a: string, b: string) => (a < b ? 1 : -1);

    return Response.json({
        stats: {
            installations: installations.length,
            repositories: repositories.length,
            indexedRepositories: repositories.filter(
                (repository) => repository.indexStatus === "INDEXED",
            ).length,
            indexingRepositories: repositories.filter(
                (repository) => repository.indexStatus === "INDEXING",
            ).length,
            failedRepositories: repositories.filter(
                (repository) => repository.indexStatus === "FAILED",
            ).length,
            pullRequestReviews: reviews.length,
            completedReviews: reviews.filter((review) => review.status === "COMPLETED")
                .length,
        },
        recentReviews: reviews.slice(0, 5).map((review) => ({
            id: review.id,
            fullName: review.fullName,
            githubPrNumber: review.githubPrNumber,
            title: review.title,
            status: review.status,
            updatedAt: review.updatedAt,
            prUrl: review.prUrl,
        })),
        recentRepositories: repositories
            .filter((repository) => repository.indexedAt)
            .sort((a, b) => byNewest(a.indexedAt ?? "", b.indexedAt ?? ""))
            .slice(0, 5)
            .map((repository) => ({
                id: repository.id,
                fullName: repository.fullName,
                indexedAt: repository.indexedAt,
            })),
    });
}