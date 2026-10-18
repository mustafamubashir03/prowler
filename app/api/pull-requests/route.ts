import { auth } from "@/lib/auth";
import { clampLimit, decodeCursor, encodeCursor } from "@/lib/pagination";
import { db } from "@/src/prisma/db";
import { headers } from "next/headers";
import { and, or } from "@prisma/orm-postgres/orm-client";

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const rawCursor = searchParams.get("cursor");
    const limit = clampLimit(searchParams.get("limit"));

// A cursor this server did not produce is a client bug or a stale link.
// Restarting from the first page instead would look like a duplicate page,
// so it is rejected outright.
const decodedCursor = rawCursor ? decodeCursor(rawCursor) : null;

if (rawCursor && (!decodedCursor?.u || !decodedCursor?.i)) {
    return Response.json({ error: "Invalid cursor" }, { status: 400 });
}

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

    if (decodedCursor?.u && decodedCursor?.i) {
        // The keyset has to match the sort exactly. Rows are ordered by
        // (updatedAt desc, id desc), so "strictly after the last row" is
        // updatedAt < cursor.updatedAt OR (equal updatedAt AND id < cursor.id).
        // A cursor on updatedAt alone drops every row sharing that timestamp.
        const { u, i } = decodedCursor;

        query = query.where((fields) =>
            or(
                fields.updatedAt.lt(u),
                and(fields.updatedAt.eq(u), fields.id.lt(i)),
            ),
        );
    }

    const rows = await query
        .orderBy((fields) => fields.updatedAt.desc())
        .orderBy((fields) => fields.id.desc())
        .limit(limit + 1)
        .all();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];

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
        nextCursor:
            hasMore && last
                ? encodeCursor({ u: last.updatedAt, i: last.id })
                : null,
    });
}