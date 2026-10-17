import { inngest } from "@/inngest/client";
import { auth } from "@/lib/auth";
import { db } from "@/src/prisma/db";
import { headers } from "next/headers";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Prisma 8 cannot filter through a to-one relation, so scope the lookup to
    // the caller's installations first. One user can never index another's repo.
    const installations = await db.orm.public.GitHubInstallation.where({
        userId: session.user.id,
    }).all();

    const installationIds = installations.map((installation) => installation.id);

    if (installationIds.length === 0) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repository = await db.orm.public.GitHubRepository.where({ id })
        .where((fields) => fields.installationId.in(installationIds))
        .first();

    if (!repository) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    await inngest.send({
        id: `index-${repository.id}-${Date.now()}`,
        name: "repo/index.requested",
        data: {
            repositoryId: repository.id,
        },
    });

    return Response.json({ ok: true, message: "Indexing started" });
}