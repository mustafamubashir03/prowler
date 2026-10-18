import { db } from "@/src/prisma/db";

/**
 * The single ownership check for "may this signed-in user touch this repository".
 *
 * Routes used to re-derive the same two-step join (session → installations →
 * repositories) in four different places. Prisma 8 cannot filter through a
 * to-one relation, which is why the join exists at all, so every copy had to be
 * correct on its own. This is the one copy.
 *
 * Identifies the repository by `githubRepositoryId`, GitHub's numeric id,
 * because that is what every caller already holds and what survives a rename.
 * Returns the row so callers do not immediately re-query it.
 */
export async function assertUserCanAccessRepository(
    userId: string,
    githubRepositoryId: string,
) {
    const installations = await db.orm.public.GitHubInstallation.where({
        userId,
    }).all();

    if (installations.length === 0) return null;

    const repository = await db.orm.public.GitHubRepository.where(
        (fields) => fields.githubRepositoryId.eq(githubRepositoryId),
    )
        .where((fields) =>
            fields.installationId.in(installations.map((i) => i.id)),
        )
        .first();

    return repository ?? null;
}