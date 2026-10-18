import { Pinecone } from '@pinecone-database/pinecone';

/** Pinecone rejects an over-long id list in a single delete call. */
const DELETE_BATCH = 1000;

/** Pinecone caps a list page at 100 ids and rejects anything higher with a 400. */
const LIST_PAGE = 100;

// Built lazily: the webhook path now reaches this module, and a module-level
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
 * Chunk ids are `{githubRepositoryId}:{path}:{chunkIndex}`.
 *
 * The namespace is keyed on GitHub's own numeric repository id rather than
 * GitHubRepository.id, which is a locally generated cuid. That cuid is recreated
 * whenever the App is reinstalled or the repository moves to another
 * installation, which silently orphaned every vector: the new row pointed at an
 * empty prefix while the old vectors stayed behind, unreachable because
 * retrieval always filters on the current repository. GitHub's id survives
 * renames, transfers and reinstalls, so the index does too.
 *
 * Listing by prefix is exact: it cannot touch a neighbouring repository whose
 * id is a string prefix of this one.
 */
export function repositoryVectorPrefix(githubRepositoryId: string) {
    return `${githubRepositoryId}:`;
}

/** Every id currently stored under a prefix. */
export async function listVectorIds(prefix: string): Promise<string[]> {
    const ids: string[] = [];
    let paginationToken: string | undefined;

    do {
        const page = await index().listPaginated({
            prefix,
            limit: LIST_PAGE,
            ...(paginationToken ? { paginationToken } : {}),
        });

        ids.push(...page.vectors?.map((vector) => vector.id ?? "").filter(Boolean) ?? []);
        paginationToken = page.pagination?.next;
    } while (paginationToken);

    return ids;
}

export async function deleteVectorsById(ids: readonly string[]) {
    for (let i = 0; i < ids.length; i += DELETE_BATCH) {
        await index().deleteMany({ ids: ids.slice(i, i + DELETE_BATCH) });
    }
}

/**
 * Drop every vector for a repository. Used when the installation loses access
 * to the repo, keyed on the same GitHub id the chunks were written under.
 */
export async function deleteRepositoryVectors(githubRepositoryId: string) {
    const stale = await listVectorIds(repositoryVectorPrefix(githubRepositoryId));

    if (stale.length > 0) {
        await deleteVectorsById(stale);
    }

    return stale.length;
}