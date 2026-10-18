import "dotenv/config";

/**
 * Finds Pinecone namespaces that no longer belong to a live repository and
 * deletes them.
 *
 * Each repository's vectors live in its own namespace, named by GitHub's
 * numeric repository id, so an orphan is a namespace with no matching
 * GitHubRepository row. That happens when the App loses access to a repository,
 * or when one is deleted.
 *
 * Deleting a namespace is one call and removes every vector in it, which is the
 * reason for namespacing in the first place.
 *
 * Dry run by default. Nothing is deleted without --apply.
 *
 *   node --experimental-strip-types --no-warnings scripts/cleanup-orphan-namespaces.mjs
 *   node --experimental-strip-types --no-warnings scripts/cleanup-orphan-namespaces.mjs --apply
 */
import {
    deleteRepositoryVectors,
    index,
    listRepositoryNamespaces,
} from "../lib/pinecone.ts";
import { db } from "../src/prisma/db.ts";

const apply = process.argv.includes("--apply");

const repositories = await db.orm.public.GitHubRepository.all();
const live = new Map(
    repositories.map((row) => [row.githubRepositoryId, row.fullName]),
);

console.log(`Live repositories: ${live.size}`);

const namespaces = await listRepositoryNamespaces();
console.log(`Namespaces in index: ${namespaces.length}`);

const orphans = namespaces.filter((name) => !live.has(name));

const empty = [...live.keys()].filter((id) => !namespaces.includes(id));

if (orphans.length === 0) {
    console.log("No orphaned namespaces.");
} else {
    console.log(`\nOrphaned namespaces: ${orphans.length}`);

    for (const name of orphans) {
        const details = await index().describeNamespace(name);
        console.log(`  ${name} -> ${details.recordCount ?? 0} vectors`);

        if (apply) {
            const removed = await deleteRepositoryVectors(name);
            console.log(`    deleted ${removed} vectors`);
        }
    }
}

console.log(`\nLive repositories with no namespace: ${empty.length}`);
for (const id of empty.slice(0, 20)) {
    console.log(`  ${id}  ${live.get(id)}`);
}
if (empty.length > 20) console.log(`  ...and ${empty.length - 20} more`);

if (apply) {
    console.log("\nApplied.");
} else {
    console.log("\nDry run. Re-run with --apply to delete these namespaces.");
}

process.exit(0);