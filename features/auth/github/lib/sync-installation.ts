import { db } from "@/src/prisma/db";
import { getInstallationOctokit, getGithubApp } from "./github-app";
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

    await db.transaction(async (tx) => {
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

        const repositoryIds = repositories.map((repository) =>
            String(repository.id),
        );

        await tx.orm.public.GitHubRepository.where({
            installationId: savedInstallation.id,
        }).deleteAll();

        if (repositoryIds.length > 0) {
            // A repository that moved between installations keeps its globally
            // unique id, so clear the old copy too. Batched for the same
            // parameter limit as the insert below.
            for (let i = 0; i < repositoryIds.length; i += INSERT_BATCH) {
                const batch = repositoryIds.slice(i, i + INSERT_BATCH);
                await tx.orm.public.GitHubRepository
                    .where((fields) => fields.githubRepositoryId.in(batch))
                    .deleteAll();
            }
        }

        if (repositories.length === 0) return;

        const rows = repositories.map((repository) => ({
            githubRepositoryId: String(repository.id),
            nodeId: text(repository.node_id),
            owner: text(repository.owner?.login),
            name: text(repository.name),
            fullName: text(repository.full_name),
            private: repository.private === true,
            defaultBranch: text(repository.default_branch),
            installationId: savedInstallation.id,
        }));

        for (let i = 0; i < rows.length; i += INSERT_BATCH) {
            await tx.orm.public.GitHubRepository.createAll(
                rows.slice(i, i + INSERT_BATCH),
            );
        }
    });
}