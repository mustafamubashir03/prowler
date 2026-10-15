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

  // Prisma 8 cannot filter through a to-one relation, so resolve the caller's
  // installations first and scope the repository query by their ids.
  const installations = await db.orm.public.GitHubInstallation.where({
    userId: session.user.id,
  }).all();

  const installationIds = installations.map((installation) => installation.id);

  if (installationIds.length === 0) {
    return Response.json({ repositories: [], nextCursor: null });
  }

  let query = db.orm.public.GitHubRepository.where((fields) =>
    fields.installationId.in(installationIds),
  );

  if (search) {
    query = query.where((fields) => fields.fullName.ilike(`%${search}%`));
  }

if (cursor) {
        // Keyset cursor must match the sort key, otherwise rows get skipped or
        // repeated across pages. Rows are ordered by fullName ascending, so the
        // cursor continues strictly after the last fullName we returned.
        query = query.where((fields) => fields.fullName.gt(cursor));
    }

    const rows = await query
        .orderBy((fields) => fields.fullName.asc())
        .orderBy((fields) => fields.id.asc())
        .limit(PAGE_SIZE + 1)
        .all();

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

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
    })),
    nextCursor: hasMore ? items[items.length - 1]?.fullName ?? null : null,
  });
}