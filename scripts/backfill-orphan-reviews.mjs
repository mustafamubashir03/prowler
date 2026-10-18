import "dotenv/config";

/**
 * One-off repair for reviews orphaned by an earlier installation sync, which
 * deleted and recreated every GitHubRepository row. Deleting the repository
 * nulls PullRequestReview.repositoryId (onDelete: SetNull), so those reviews
 * were excluded from /api/pull-requests and /api/overview even though the
 * repository they belong to was still reachable.
 *
 * The link is rebuilt from PullRequestReview.githubRepositoryId, which is
 * GitHub's numeric repository id and is exactly the column GitHubRepository is
 * uniquely keyed on, so no guessing on names is involved. fullName is used only
 * as a consistency check: a review whose fullName disagrees with the repository
 * row it would link to is left alone rather than attached to a repository it was
 * never written for.
 *
 * Idempotent: it only touches rows where repositoryId IS NULL, so a second run
 * finds nothing to do. Rows that stay orphaned are reported, not guessed at.
 *
 *   node --experimental-strip-types --no-warnings scripts/backfill-orphan-reviews.mjs
 *   node --experimental-strip-types --no-warnings scripts/backfill-orphan-reviews.mjs --dry-run
 */

const { db } = await import("../src/prisma/db.ts");

const dryRun = process.argv.includes("--dry-run");

const orphans = await db.orm.public.PullRequestReview.where((fields) =>
    fields.repositoryId.isNull(),
).all();

if (orphans.length === 0) {
    console.log("No orphaned reviews to relink.");
    process.exit(0);
}

const repositories = await db.orm.public.GitHubRepository.all();

const byGithubId = new Map(
    repositories.map((repository) => [repository.githubRepositoryId, repository]),
);

let relinked = 0;
let mismatched = 0;
let unmatched = 0;
const stillOrphaned = [];

for (const review of orphans) {
    const repository = byGithubId.get(review.githubRepositoryId);

    if (!repository) {
        unmatched += 1;
        stillOrphaned.push({
            id: review.id,
            githubRepositoryId: review.githubRepositoryId,
            fullName: review.fullName,
            reason: "no repository with that GitHub id",
        });
        continue;
    }

    if (repository.fullName !== review.fullName) {
        mismatched += 1;
        stillOrphaned.push({
            id: review.id,
            githubRepositoryId: review.githubRepositoryId,
            reviewFullName: review.fullName,
            repositoryFullName: repository.fullName,
            reason: "fullName disagrees with the repository row",
        });
        continue;
    }

    if (dryRun) {
        relinked += 1;
        continue;
    }

    await db.orm.public.PullRequestReview.where({ id: review.id }).update({
        repositoryId: repository.id,
    });

    relinked += 1;
}

console.log(`Scanned ${orphans.length} orphaned review(s)${dryRun ? " (dry run, nothing written)" : ""}.`);
console.log(`  relinked:  ${relinked}`);
console.log(`  mismatched fullName: ${mismatched}`);
console.log(`  no matching repository: ${unmatched}`);

if (stillOrphaned.length > 0) {
    console.log("Left orphaned (a re-run will not change these):");
    for (const row of stillOrphaned) {
        console.log(`  ${row.id} ${row.reason}`);
    }
}

process.exit(0);