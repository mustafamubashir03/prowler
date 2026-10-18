import { Pinecone } from '@pinecone-database/pinecone';

/** Pinecone rejects an over-long id list in a single delete call. */
const DELETE_BATCH = 1000;

/** Server-side default page size for list-by-id is 100; ask for a bigger one. */
const LIST_PAGE = 1000;

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
 * Chunk ids are `{repositoryId}:{path}:{chunkIndex}`, so every vector belonging
 * to one repository shares this prefix. Listing by it is exact: it cannot touch
 * a neighbouring repository whose id is a string prefix of this one.
 */
export function repositoryVectorPrefix(repositoryId: string) {
    return `${repositoryId}:`;
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
 * to the repo, where the row (and its id-keyed namespace) is about to go too.
 */
export async function deleteRepositoryVectors(repositoryId: string) {
    const stale = await listVectorIds(repositoryVectorPrefix(repositoryId));

    if (stale.length > 0) {
        await deleteVectorsById(stale);
    }

    return stale.length;
}