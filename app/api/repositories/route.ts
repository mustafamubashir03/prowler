import { auth } from "@/lib/auth";
import { db } from "@/src/prisma/db";
import { headers } from "next/headers";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") ?? "").trim().replace(/[%_]/g, "");
  const cursor = searchParams.get("cursor");
  const sort = (searchParams.get("sort") ?? "name").toLowerCase();

  // Only these keys are honoured; anything else falls back to name.
  const sortKey = (
    ["name", "updated", "status"].includes(sort) ? sort : "name"
  ) as "name" | "updated" | "status";

  // Prisma 8 cannot filter through a to-one relation, so resolve the caller's
  // installations first and scope the repository query by their ids.
  const installations = await db.orm.public.GitHubInstallation.where({
    userId: session.user.id,
  }).all();

  const installationIds = installations.map((installation) => installation.id);

  if (installationIds.length === 0) {
    return Response.json({ repositories: [], nextCursor: null });
  }

  const targetLoginByInstallationId = new Map(
    installations.map((installation) => [installation.id, installation.targetLogin]),
  );

  let query = db.orm.public.GitHubRepository.where((fields) =>
    fields.installationId.in(installationIds),
  );

  if (search) {
    query = query.where((fields) => fields.fullName.ilike(`%${search}%`));
  }

    const direction = sort === "desc" ? "desc" : "asc";
    const desc = direction === "desc";
    // Only name ordering is cursor-safe. Other keys are not unique, so a keyset
    // cursor would skip or repeat rows; those page by offset instead. Prisma 8
    // has no .skip(), and the repository set is small, so the slice is done here.
    const cursorSafe = sortKey === "name";
    const offset = Number(searchParams.get("offset") ?? "0");

    if (cursorSafe && cursor) {
        query = query.where((fields) =>
            desc ? fields.fullName.lt(cursor) : fields.fullName.gt(cursor),
        );
    }

    const ordered =
        sortKey === "updated"
            ? query
                  .orderBy((fields) => fields.updatedAt[desc ? "desc" : "asc"]())
                  .orderBy((fields) => fields.fullName.asc())
            : sortKey === "status"
              ? query
                    .orderBy((fields) =>
                        fields.indexStatus[desc ? "desc" : "asc"](),
                    )
                    .orderBy((fields) => fields.fullName.asc())
              : query
                    .orderBy((fields) =>
                        fields.fullName[desc ? "desc" : "asc"](),
                    )
                    .orderBy((fields) => fields.id.asc());

    let rows;
    let hasMore: boolean;
    let items;

    if (cursorSafe) {
        rows = await ordered.limit(PAGE_SIZE + 1).all();
        hasMore = rows.length > PAGE_SIZE;
        items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    } else {
        const all = await ordered.all();
        items = all.slice(offset, offset + PAGE_SIZE);
        hasMore = offset + PAGE_SIZE < all.length;
    }

  return Response.json({
    repositories: items.map((repository) => ({
      id: repository.id,
      githubRepositoryId: repository.githubRepositoryId,
      nodeId: repository.nodeId,
      name: repository.name,
      fullName: repository.fullName,
      owner: repository.owner,
      private: repository.private,
      defaultBranch: repository.defaultBranch,
      indexStatus: repository.indexStatus,
      indexedAt: repository.indexedAt,
      installationId: repository.installationId,
      installation: {
        targetLogin: targetLoginByInstallationId.get(repository.installationId) ?? null,
      },
    })),
    nextCursor:
      hasMore && cursorSafe
        ? items[items.length - 1]?.fullName ?? null
        : null,
    nextOffset: hasMore && !cursorSafe ? offset + PAGE_SIZE : null,
    sort: sortKey,
    direction,
  });
}