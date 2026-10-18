import { Pinecone } from '@pinecone-database/pinecone';

/** Pinecone rejects an over-long id list in a single delete call. */
const DELETE_BATCH = 1000;

/**
 * Pinecone caps a list page at 100 ids and answers anything larger with
 * `400 Limit must be greater than 0 and less than or equal to 100`, which made
 * every prune-stale-chunks step fail. listVectorIds pages with paginationToken
 * until the index stops returning one, so the cap costs round trips, not
 * correctness.
 */
const LIST_PAGE = 100;

// Built lazily: the webhook path reaches this module, and a module-level
// `new Pinecone(...)` would make every installation sync fail on import when the
// vector store is not configured, instead of only the runs that need it.
let client: Pinecone | undefined;

function getClient() {
    client ??= new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!,
    });

    return client;
}

export function index() {
    return getClient().index({ name: process.env.PINECONE_INDEX_NAME! });
}

/**
 * One Pinecone namespace per repository, named by GitHub's numeric repository
 * id.
 *
 * Namespacing is what makes removing a repository a single call instead of a
 * list-then-delete, and it bounds every listing and query to one repository
 * without relying on a metadata filter the caller could get wrong.
 *
 * The namespace is always resolved here, from the repository row that
 * assertUserCanAccessRepository already returned. It is never taken from a
 * query string, a webhook body or a model-supplied argument.
 */
export function repoIndex(githubRepositoryId: string) {
    return index().namespace(String(githubRepositoryId));
}

/** Every id currently stored in one repository's namespace. */
export async function listRepoVectorIds(
    githubRepositoryId: string,
): Promise<string[]> {
    const ids: string[] = [];
    let paginationToken: string | undefined;

    do {
        const page = await repoIndex(githubRepositoryId).listPaginated({
            limit: LIST_PAGE,
            ...(paginationToken ? { paginationToken } : {}),
        });

        ids.push(...(page.vectors?.map((vector) => vector.id ?? "").filter(Boolean) ?? []));
        paginationToken = page.pagination?.next;
    } while (paginationToken);

    return ids;
}

export async function deleteRepoVectorsById(
    githubRepositoryId: string,
    ids: readonly string[],
) {
    const scoped = repoIndex(githubRepositoryId);

    for (let i = 0; i < ids.length; i += DELETE_BATCH) {
        await scoped.deleteMany({ ids: ids.slice(i, i + DELETE_BATCH) });
    }
}

/**
 * Drop everything for a repository in one call. Used when the installation
 * loses access to the repo, which is exactly the case the old list-then-delete
 * could not complete cleanly.
 */
export async function deleteRepositoryVectors(githubRepositoryId: string) {
    const details = await index().describeNamespace(
        String(githubRepositoryId),
    );

    if ((details.recordCount ?? 0) === 0) return 0;

    await index().deleteNamespace(String(githubRepositoryId));

    return details.recordCount ?? 0;
}

/** Every namespace in the index, excluding Pinecone's own __default__. */
export async function listRepositoryNamespaces(): Promise<string[]> {
    const names: string[] = [];
    let paginationToken: string | undefined;

    do {
        const page = await index().listNamespaces({
            limit: LIST_PAGE,
            ...(paginationToken ? { paginationToken } : {}),
        });

        for (const entry of page.namespaces ?? []) {
            const name = entry.name ?? "";

            // __default__ is Pinecone's built-in, never a repository.
            if (name && !name.startsWith("__")) names.push(name);
        }

        paginationToken = page.pagination?.next;
    } while (paginationToken);

    return names;
}