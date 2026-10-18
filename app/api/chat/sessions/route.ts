import { requireRepositoryAccess } from "@/lib/github/guard";
import { db } from "@/src/prisma/db";

export async function GET(request: Request) {
    const id = new URL(request.url).searchParams.get("githubRepositoryId");

    const access = await requireRepositoryAccess(id);

    if ("response" in access) return access.response;

    const { userId, repository } = access;

    const sessions = await db.orm.public.ChatSession.where({
        userId,
        githubRepositoryId: repository.githubRepositoryId,
    })
        .orderBy((fields) => fields.updatedAt.desc())
        .limit(50)
        .all();

    return Response.json(
        sessions.map((row) => ({
            id: row.id,
            title: row.title,
            updatedAt: row.updatedAt,
        })),
    );
}