import { assertUserCanAccessRepository } from "@/lib/github/tenancy";
import { auth } from "@/lib/auth";
import { db } from "@/src/prisma/db";
import { headers } from "next/headers";

export async function GET(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = new URL(request.url).searchParams.get("githubRepositoryId");

    if (!id) {
        return Response.json(
            { error: "githubRepositoryId is required" },
            { status: 400 },
        );
    }

    const repository = await assertUserCanAccessRepository(session.user.id, id);

    if (!repository) {
        return Response.json({ error: "Not found" }, { status: 404 });
    }

    const sessions = await db.orm.public.ChatSession.where({
        userId: session.user.id,
        githubRepositoryId: id,
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