import { db } from "@/src/prisma/db";
import { getInstallationOctokit, getGithubApp } from "./github-app";
import { deleteRepositoryVectors } from "@/lib/pinecone";
import { Octokit } from "@octokit/rest";

/**
 * GitHub returns null for a few fields on real repositories: an empty
 * repository has no default_branch. Every one of these columns is NOT NULL, so
 * a single null would roll back the whole sync and silently save nothing.
 */
const text = (value: unknown): string =>
    typeof value === "string" && value.length > 0 ? value : "";

/** Postgres caps a statement at 65535 bind parameters; keep each batch well under. */
const INSERT_BATCH = 1000;

export async function syncInstallation(
    githubInstallationId: number,
    userId?: string,
) {
    // getGithubApp()/getInstallationOctokit hand back a bare @octokit/core client
    // whose type omits the REST namespace and the paginate plugin. The App is
    // built with @octokit/rest's Octokit, so both are present at runtime; these
    // casts only restore the types. Resolved per call so importing this module
    // never requires the App credentials.
    const restOctokit = getGithubApp().octokit as Octokit;

    const { data: installation } =
        await restOctokit.rest.apps.getInstallation({
            installation_id: githubInstallationId,
        });

    const octokit = (await getInstallationOctokit(githubInstallationId)) as Octokit;
    const repositories = await octokit.paginate(
        octokit.rest.apps.listReposAccessibleToInstallation,
        { per_page: 100 },
        (response) => response.data,
    );

    const account = installation.account as {
        id: number;
        login?: string;
        slug?: string;
    };

    const removedRepositoryIds = await db.transaction(async (tx) => {
        const savedInstallation = await tx.orm.public.GitHubInstallation.upsert({
            conflictOn: {
                githubInstallationId: String(githubInstallationId),
            },
            create: {
                githubInstallationId: String(githubInstallationId),
                targetId: String(installation.target_id),
                targetLogin: account.login ?? account.slug ?? "unknown",
                targetType: installation.target_type,
                repositorySelection: installation.repository_selection,
                status: installation.suspended_at ? "SUSPENDED" : "ACTIVE",
                userId,
            },
            update: {
                targetId: String(installation.target_id),
                targetLogin: account.login ?? account.slug ?? "unknown",
                targetType: installation.target_type,
                repositorySelection: installation.repository_selection,
                status: installation.suspended_at ? "SUSPENDED" : "ACTIVE",
                ...(userId ? { userId } : {}),
            },
        });

        // Read before writing: these are the rows this installation currently
        // owns, so the removal set below is known up front.
        const current = await tx.orm.public.GitHubRepository.where({
            installationId: savedInstallation.id,
        }).all();

        // Identity is GitHub's numeric repository id, never the name. A rename
        // or a transfer keeps that id, so the row updates in place: its cuid is
        // referenced by PullRequestReview (onDelete: SetNull) and is the Pinecone
        // namespace, so recreating the row would detach every stored review,
        // reset indexStatus/indexedAt and orphan the vectors.
        //
        // upsert on the unique githubRepositoryId makes a redelivered or
        // concurrent webhook converge on the same row instead of racing into a
        // unique violation. The update set deliberately omits indexStatus and
        // indexedAt so metadata refreshes never force a re-index.
        for (const repository of repositories) {
            const githubRepositoryId = String(repository.id);

            const mutable = {
                nodeId: text(repository.node_id),
                owner: text(repository.owner?.login),
                name: text(repository.name),
                fullName: text(repository.full_name),
                private: repository.private === true,
                defaultBranch: text(repository.default_branch),
                // A repository can move between installations; the row follows
                // the grant rather than being duplicated.
                installationId: savedInstallation.id,
            };

            await tx.orm.public.GitHubRepository.upsert({
                conflictOn: { githubRepositoryId },
                create: { githubRepositoryId, ...mutable },
                update: mutable,
            });
        }

        const reachable = new Set(
            repositories.map((repository) => String(repository.id)),
        );

        const removed = current
            .filter((repository) => !reachable.has(repository.githubRepositoryId))
            .map((repository) => repository.id);

        for (let i = 0; i < removed.length; i += INSERT_BATCH) {
            const batch = removed.slice(i, i + INSERT_BATCH);
            await tx.orm.public.GitHubRepository
                .where((fields) => fields.id.in(batch))
                .deleteAll();
        }

        return removed;
    });

    // Outside the transaction on purpose. The row is already gone, so the
    // vectors are inert orphans if this fails and are retried by the next sync;
    // holding the transaction open across a network call would instead pin the
    // installation's locks for the duration.
    for (const repositoryId of removedRepositoryIds) {
        try {
            await deleteRepositoryVectors(repositoryId);
        } catch (error) {
            // Losing the row is the authoritative outcome; the leftover vectors
            // are unreachable because retrieval always filters by repositoryId.
            console.error(
                `[github] dropped repository ${repositoryId} but could not delete its vectors`,
                error instanceof Error ? error.name : typeof error,
            );
        }
    }
}