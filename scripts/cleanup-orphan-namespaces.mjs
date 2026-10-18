import "dotenv/config";

/**
 * Finds and removes chunk ids that no longer belong to any live repository.
 *
 * Everything is written into Pinecone's default namespace, so isolation between
 * repositories is not a namespace at all: it is the `{key}:{path}:{chunkIndex}`
 * id prefix, plus a metadata filter on retrieval. That means "orphaned vectors"
 * has to be discovered by listing real ids and reading their prefixes, because
 * listNamespaces() only ever reports __default__.
 *
 * An orphan is any prefix that is not a live GitHub numeric repository id.
 * That covers both a repository the installation lost, and chunks written by an
 * older build keyed on the locally generated row id, which no longer matches
 * anything.
 *
 * Dry run by default. Nothing is deleted without --apply.
 *
 *   node --experimental-strip-types --no-warnings scripts/cleanup-orphan-namespaces.mjs
 *   node --experimental-strip-types --no-warnings scripts/cleanup-orphan-namespaces.mjs --apply
 */
import { index } from "../lib/pinecone.ts";
import { db } from "../src/prisma/db.ts";

const apply = process.argv.includes("--apply");
const PAGE = 100;

const repositories = await db.orm.public.GitHubRepository.all();
const live = new Set(repositories.map((row) => row.githubRepositoryId));

console.log(`Live repositories: ${live.size}`);

// Pinecone caps a list page at 100 and hands back a token for the next one.
async function listEveryId() {
    const ids = [];
    let paginationToken;

    do {
        const page = await index().listPaginated({
            limit: PAGE,
            ...(paginationToken ? { paginationToken } : {}),
        });

        for (const vector of page.vectors ?? []) {
            if (vector.id) ids.push(vector.id);
        }

        paginationToken = page.pagination?.next;
    } while (paginationToken);

    return ids;
}

const ids = await listEveryId();
console.log(`Vectors in index: ${ids.length}`);

const orphanPrefixes = new Map();

for (const id of ids) {
    const prefix = id.split(":")[0];

    // A chunk id is {key}:{path}:{chunkIndex}, so an id with no colon is not
    // one of ours and is left alone.
    if (!prefix || !id.includes(":")) continue;
    if (live.has(prefix)) continue;

    orphanPrefixes.set(prefix, (orphanPrefixes.get(prefix) ?? 0) + 1);
}

if (orphanPrefixes.size === 0) {
    console.log("No orphaned vectors.");
    process.exit(0);
}

console.log(`\nOrphaned prefixes: ${orphanPrefixes.size}`);

const doomed = [];

for (const [prefix, count] of [...orphanPrefixes].sort()) {
    console.log(`  ${prefix} -> ${count} vectors`);

    for (const id of ids) {
        if (id.startsWith(`${prefix}:`)) doomed.push(id);
    }
}

console.log(`\nTotal vectors to remove: ${doomed.length}`);

if (!apply) {
    console.log("Dry run. Re-run with --apply to delete these vectors.");
    process.exit(0);
}

for (let i = 0; i < doomed.length; i += 1000) {
    await index().deleteMany({ ids: doomed.slice(i, i + 1000) });
}

console.log(`Deleted ${doomed.length} vectors across ${orphanPrefixes.size} prefixes.`);
process.exit(0);