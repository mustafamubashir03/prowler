import { auth } from "@/lib/auth";
import { clampLimit } from "@/lib/pagination";
import { db } from "@/src/prisma/db";
import { headers } from "next/headers";

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const cursor = searchParams.get("cursor");
    const limit = clampLimit(searchParams.get("limit"));

    const installations = await db.orm.public.GitHubInstallation.where({
        userId: session.user.id,
    }).all();

    const repositoryIds = installations.length
        ? (
              await db.orm.public.GitHubRepository.where((fields) =>
                  fields.installationId.in(installations.map((i) => i.id)),
              ).all()
          ).map((repository) => repository.id)
        : [];

    if (repositoryIds.length === 0) {
        return Response.json({ reviews: [], nextCursor: null });
    }

    let query = db.orm.public.PullRequestReview.where((fields) =>
        fields.repositoryId.in(repositoryIds),
    );

    if (status) {
        query = query.where((fields) => fields.status.eq(status));
    }

    if (cursor) {
        // Keyset cursor must match the sort key, otherwise rows get skipped or
        // repeated across pages. Rows are ordered by updatedAt descending, so
        // the cursor continues strictly below the last row we returned.
        query = query.where((fields) => fields.updatedAt.lt(cursor));
    }

    const rows = await query
        .orderBy((fields) => fields.updatedAt.desc())
        .orderBy((fields) => fields.id.desc())
        .limit(limit + 1)
        .all();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return Response.json({
        reviews: items.map((review) => ({
            id: review.id,
            githubPrNumber: review.githubPrNumber,
            githubRepositoryId: review.githubRepositoryId,
            repositoryId: review.repositoryId,
            fullName: review.fullName,
            repoName: review.repoName,
            owner: review.owner,
            title: review.title,
            author: review.author,
            prUrl: review.prUrl,
            status: review.status,
            reviewBody: review.reviewBody,
            updatedAt: review.updatedAt,
        })),
        nextCursor: hasMore ? items[items.length - 1]?.updatedAt ?? null : null,
    });
}