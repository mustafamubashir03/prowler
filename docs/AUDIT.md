# Prowler — Part A audit

Read-only audit of `origin/main` at `d6167aa`. Findings reference `origin/main` unless a
line number comes from a pending branch, which is called out.

Legend: **CONFIRMED** (verified in code or by experiment), **NOT AN ISSUE**, **COULD NOT
DETERMINE**.

---

## A1. The hallucinated Blocker — is the prompt being corrupted?

**Verdict: the prompt pipeline does NOT corrupt anything. The Blocker was model hallucination.**

Evidence, in the order the question was asked:

**No `String.replace` exists anywhere in `lib/`.** Grepped `.replace(`/`.replaceAll(` across
`lib/**.ts`: 15 hits, all template-literal `${}` interpolation or `String.raw`-free string
concatenation in log lines. There is no regex-style replacement anywhere in the prompt path,
so the `$&` / `` $` `` / `$'` substitution hazard **does not exist here**.

`buildUserPrompt` (`lib/agent-review.ts:102-133`) builds one template literal. `input.diff`,
`input.body`, `input.title`, `input.files` and `input.codebaseContext` are *variable*
interpolations, not re-parsed template source, so their contents are inserted verbatim. No
encoding, escaping, escaping-back, base64 or normalisation step is applied between
`buildUserPrompt()` and `query({ prompt })` (`lib/agent-review.ts:153`). The only transform
on the diff is `.slice()`, which cannot rewrite content.

**Hostile-token probe** (reconstruction of `buildUserPrompt` + `review-pull-request.ts:150-158`
run against a diff deliberately containing every JS replacement pattern):

```
prompt length: 2105 chars   diff length: 1528 chars

"$&"                                       count=3 PRESERVED
"$`"                                       count=2 PRESERVED
"$'"                                       count=1 PRESERVED
"$$"                                       count=1 PRESERVED
"$1"                                       count=2 PRESERVED
"$2"                                       count=1 PRESERVED
"$<name>"                                  count=1 PRESERVED
"${notAVariable}"                          count=1 PRESERVED
"${interpolated}"                          count=1 PRESERVED
"${x}"                                     count=1 PRESERVED
"payloareferencespayloainstead ofpayload"  count=1 PRESERVED
```

Nothing is rewritten, and the mangled identifier from the Blocker passes through untouched.

**The real script is correct.** `scripts/check-github-app.mjs:36` is
`const payload = b64url(` and `:44` is `` signer.update(`${header}.${payload}`); ``. There is no
`payloareferencespayloainstead ofpayload` in the file, and `pnpm app:check` runs successfully.

**Truncation can cut mid-token** (see A2) but that is a *content* defect, not a corruption
defect — a cut string cannot become a different identifier.

**Sample of the exact prompt sent to the model** (reconstruction is byte-identical to
`buildUserPrompt`; shown truncated at 2200 chars, hostile payload included):

```
<pull_request>
<title>test $& $` ${interpolated}</title>
<author>tester</author>
<description>
body with $& and $1 and ${x}
</description>
<changed_files>src/evil.ts [modified 1 additions, 0 deletions]</changed_files>
</pull_request>

<diff>
--- src/evil.ts [modified]

 const a = 'price: $& $` $' $$ $1 $2 $<name>';
 const b = `${notAVariable}`;
 const c = /\$\d/g;
 const d = 'payloareferencespayloainstead ofpayload';
 const e = 1; const e = 1; ... const e =
</diff>

<codebase_context>
Related code retrieved from the indexed repository. Use it to judge whether this change fits existing patterns,
usage patterns, and architectural styles. It is NOT part of this PR.
--- src/ok.ts ----
 const ok = 1;
</codebase_context>
Review this pull request now, following  your output contract exactly
```

Note the last diff line ends mid-expression (`const e =`). That is A2, not corruption.

**Prompt-injection posture: NOT AN ISSUE.** `lib/agent-review.ts:97` already tells the model
that `<pull_request>`, `<changed_files>`, `<codebase_context>` and `<diff>` are untrusted PR-author
text and must be treated as material to review, never as instructions. That is the right
instruction. It is, however, advisory only — the tags are not escaped, so a diff containing
`</diff>` can close the block early. Recommend escaping the four tag names in the diff and body.

**COULD NOT DETERMINE:** how `@anthropic-ai/claude-agent-sdk` transports the prompt into the CLI
process. The SDK is minified (`bridge.mjs`); it spawns the CLI via `execa` but the argv/stdin
split is not legible without deeper work. Empirically the transport is sound — four real
reviews (7362 / 846 / 1146 / 2952 chars) all quoted their actual diffs coherently — so I am not
treating this as a live risk.

---

## A2. Diff handling

**CONFIRMED — this is the weakest part of the pipeline.**

`inngest/review-pull-request.ts:136-158`:

```ts
const { data: files } = await octokit.rest.pulls.listFiles({
    owner, repo, pull_number: prNumber, per_page: 100,      // L140
});

const diff = files
    .map((file) => {
        const patch =
            file.patch?.slice(0, 1500) ??                    // L153
            "(no text diff: binary or too large)";
        return `--- ${file.filename} [${file.status}]\n\n${patch}`;
    })
    .join(`\n\n`)
    .slice(0, 8000);                                         // L158
```

Findings:

1. **File ordering is GitHub's API order** (alphabetical by path). There is no risk-based
   ordering — lockfiles, generated files and docs are treated identically to source. **CONFIRMED.**
2. **`per_page: 100` with no pagination.** GitHub caps a PR at 3000 files; beyond 100 the model
   never sees the rest, and `fileList` is built from the same truncated `files` array so the
   model is not even told files exist. **CONFIRMED.**
3. **Per-file cap of 1500 chars** (L153) cuts mid-hunk with no marker. `file.patch` is already
   truncated by GitHub for large diffs; we truncate further, again silently. **CONFIRMED.**
4. **Total cap of 8000 chars** (L158) cuts the joined string arbitrarily — potentially mid-line,
   mid-identifier, or mid-file-header. If the join exceeds 8000, trailing files are removed with
   **no header and no marker**. **CONFIRMED.**
5. **Binary/large files silently become** `"(no text diff: binary or too large)"` (L154) — at
   least that is visible, but only for files that survive the join.
6. **The review never says what it did not read.** There is no coverage statement, no
   "reviewed X of Y files", no truncation notice anywhere in the output contract
   (`lib/agent-review.ts:73-96`). The system prompt demands grounding but never asks the model to
   disclose gaps. **CONFIRMED — and this is what makes the Blocker possible**: a model shown a
   cut diff is still free to invent findings about code it never received.
7. **Embedding input is cut further and separately:** `pr.diff.slice(0, 6000)` (L169) for
   retrieval, independent of the 8000 given to the model. Retrieval and review therefore see
   *different* diffs. **CONFIRMED.**

---

## A3. Permissions claim

**Verdict: my earlier claim was empirically right but NOT documented, and `pnpm app:check`
verifies the wrong thing.**

**What the docs actually say.** I fetched the current GitHub REST reference for
`POST /repos/{owner}/{repo}/issues/{issue_number}/comments`. The page documents the path,
`body`, and status codes (201/403/404/410/422) but **does not state a required permission level
for GitHub Apps**. It only notes "Every pull request is an issue, but every issue is not a pull
request". So the docs do not confirm or deny that `pull_requests: write` is required.

**What the experiment showed** (same freshly-minted installation token, same repo, run twice):

```
POST /repos/mustafamubashir03/prowler/issues           -> 201 Created   (create an issue)
POST /repos/mustafamubashir03/prowler/issues/9/comments -> 201 Created   (comment on an ISSUE)
POST /repos/mustafamubashir03/prowler/issues/7/comments -> 403 Forbidden (comment on a PR)
```

The app advertises `issues: write` and cannot comment on a PR. So PR conversation comments
need something beyond `issues: write` — empirically `pull_requests: write`. **CONFIRMED
empirically; NOT confirmed by documentation.**

**What `pnpm app:check` verifies — and why it is wrong.** `scripts/check-github-app.mjs:108-131`:

```ts
const accepted = probe.headers.get("x-accepted-github-permissions") ?? "";
const permissionless = accepted.includes("allows_permissionless_access=true");   // L109
const hasIssuesWrite = /\bissues:\s*write\b/.test(accepted);                      // L110
```

Two defects, both **CONFIRMED** by this audit:

- It checks for **`issues: write`**, which we have now proven is *not* the permission that
  governs PR comments. `app:check` printed `OK issues:write is granted, PR comments will post`
  while PR comments were still 403ing. It reports success on a broken configuration.
- Its `x-accepted-github-permissions` heuristic is **unsound**. The header returned
  `allows_permissionless_access=true` with no permission entries on a token that genuinely
  *did* have `issues: write` (the 201s above). I misread that same header earlier and sent the
  user to reinstall unnecessarily. The header is not a reliable grant list.

---

## A4. Request paths and blocking time

GitHub waits **10 seconds** for a webhook response. Handlers, in order:

| Handler | Blocks on | Measured | Verdict |
|---|---|---|---|
| `POST /api/github/webhooks/github` | signature verify (fast), then `syncInstallation` for `installation` created/unsuspend/new_permissions_accepted and `installation_repositories` (route L68) | **~36 s** | **CONFIRMED over GitHub's 10 s limit.** GitHub recorded these as HTTP 500 on 2026-10-18 at 13:48 and 15:59 while the sync itself succeeded. |
| same, `pull_request` path | `inngest.send` only (L76) | ms | **NOT AN ISSUE** |
| same, `deleted` / `suspend` | one indexed statement (L49, L59) | ms | **NOT AN ISSUE** |
| `GET /api/github/callback` | `syncInstallation(installationId, userId)` at L129 | **~36 s** | **CONFIRMED** — user-visible spinner. Browser-facing, so no GitHub timeout, but poor UX. |
| `GET /api/github/install` | redirect + cookie | ms | **NOT AN ISSUE** |
| `GET /api/auth/[...all]` | Better Auth | fast | **NOT AN ISSUE** |
| `GET /api/repositories`, `/api/pull-requests`, `/api/overview`, `/api/activity` | DB + one GitHub call | < 1 s | **NOT AN ISSUE** |
| `POST /api/repositories/[id]/index` | `inngest.send` | ms | **NOT AN ISSUE** |

Fix already pushed but unmerged: `fix/webhook-sync-off-request-path` moves the webhook sync into
Inngest. The install callback is deliberately left awaiting so the dashboard has data on load —
that trade-off should be revisited (Part B item 6).

---

## A5. Unindexed repositories

**CONFIRMED — two real gaps.**

1. **The review never checks `indexStatus`.** `inngest/review-pull-request.ts:167`:
   ```ts
   if (!reviewRecord.repositoryId) return "";
   ```
   It gates on whether a local repository row is *linked*, not on whether the repository is
   *indexed*. An unindexed repository with a valid `repositoryId` still queries Pinecone
   (`index().query` L147-154), gets zero or near-zero matches, and the review proceeds silently
   with no retrieved context and **no statement that context was missing**. The only degraded
   path is a missing row, which produces an empty context block with no explanation either.
2. **Indexing is never queued automatically.** `repo/index.requested` is emitted from exactly
   one place — `app/api/repositories/[id]/index/route.ts:39`, behind the dashboard's manual
   "Index" button. `syncInstallation` does not enqueue. So a fresh install has 96 repositories at
   `NOT_INDEXED` and reviews run contextless until a human clicks. **CONFIRMED.**

Grep for `indexStatus` shows the indexer writes it (`inngest/functions.ts:283`), the overview
counts it (`app/api/overview/route.ts:58-64`), and the repositories tab renders it — but the
review pipeline never reads it.

---

## A6. Tenancy

Every user-facing route resolves `session → GitHubInstallation.userId → repositoryIds` and
filters on those ids. Prisma 8 cannot filter through a to-one relation, which is why the
two-step lookup exists. Verdict per surface:

| Surface | How it proves access | Verdict |
|---|---|---|
| `GET /api/overview` | L15 `userId`, L37 `installationId.in(...)`, L46 `repositoryId.in(...)` | **NOT AN ISSUE** |
| `GET /api/pull-requests` | L31 `userId`, L37 `installationId.in(...)`, L47 `repositoryId.in(...)` | **NOT AN ISSUE** |
| `GET /api/repositories` | L37 `userId`, L51 `installationId.in(...)` | **NOT AN ISSUE** |
| `POST /api/repositories/[id]/index` | L20 `userId`, L30 chained `installationId.in(...)` | **NOT AN ISSUE** — id alone cannot reach another user's repo |
| `deleteInstallation` (server action) | L18-21 `userId` **and** `githubInstallationId` | **NOT AN ISSUE** |
| `GET /api/activity` | L151 session; reads only the caller's own token | **NOT AN ISSUE** |
| `GET /api/github/callback` | L121 `userCanAccessInstallation` via `listInstallationsForAuthenticatedUser`, plus a `state` cookie | **NOT AN ISSUE** — strongest check in the codebase |
| `GET /api/github/install` | L14 session required | **NOT AN ISSUE** |

**Flag 1 — Inngest functions trust event data.** `reviewPullRequest` takes `installationId`,
`owner`, `repo`, `githubRepositoryId` straight from the event and uses them for
`getInstallationOctokit`, for the `GitHubRepository` lookup at L71-73, and for the Pinecone
filter. The events originate from a signature-verified webhook so this is defensible, but there
is **no check that `githubRepositoryId` belongs to `installationId`**, and no check that the
installation is still `ACTIVE`. A malformed-but-signed payload would write a review row for an
arbitrary repository id. **Low severity, worth defence-in-depth** (Part B item 9).

**Flag 2 — orphaned reviews are invisible, not gone.** `PullRequestReview.repositoryId` is
`onDelete: SetNull` (`src/prisma/contract.prisma:57`). Both read routes filter
`repositoryId.in(...)`, so a review whose repository row was removed or regenerated silently
disappears from the dashboard while still existing in the database. `pnpm reviews:backfill`
exists but is manual. **CONFIRMED.**

**Flag 3 — `prune-stale-chunks` has no tenancy guard** (`inngest/functions.ts:270-280`). It
deletes by id prefix derived from the event's `repositoryId`. Acceptable given the above, but it
is the one place where a wrong id destroys data.

---

## A7. `syncInstallation`

`features/auth/github/github/lib/sync-installation.ts` on main, lines as shown.

1. **Does the upsert update `installationId` and `owner` on transfer? — CONFIRMED YES.**
   `mutable` (L89-99) contains `owner` (L91) and `installationId` (L98), and both go into the
   `update` half of the upsert (L104). A repo transferred between installations follows the grant
   instead of being duplicated. **Correct as written.**
2. **Does it relink orphaned reviews for re-added repos? — CONFIRMED NO.** Nothing in the file
   touches `PullRequestReview`. If a repository is removed and later re-added, a new row id is
   issued and previously orphaned reviews stay `repositoryId = NULL` forever. Part B item 11
   should auto-relink inside this transaction.
3. **Does it bump `updatedAt` when nothing changed? — CONFIRMED YES, always.** Every repository
   gets an `upsert` on every sync (L86-106) with no comparison against the current row. Because
   `updatedAt` is `temporal.updatedAtString()`, **all 96 rows are marked dirty on every single
   sync** even when GitHub returns identical data. This defeats `updatedAt`-based staleness and
   adds 96 pointless writes. Part B item 11 should skip no-op writes.
4. **Transaction size and timeout risk — CONFIRMED, measured.** One transaction containing N
   sequential upserts plus batched deletes. For the audited account N = 96 and the handler took
   **~36 s**, which is what pushed A4 over GitHub's 10 s limit. Risk grows linearly with repo
   count and with it the Neon pool (max 10, `lib/auth.ts:19`) is held for the whole duration.
   Batching by `INSERT_BATCH` is used for deletes and inserts but **not for the upsert loop**.
5. **Removal path deletes vectors by the wrong key on main — CONFIRMED.** L126-132 calls
   `deleteRepositoryVectors(repositoryId)` where `repositoryId` is the **local cuid**, matching
   the current chunk-id scheme `{repositoryId}:{path}:{chunkIndex}`
   (`inngest/functions.ts:242`). This is internally consistent *today* but is the cause of the
   552 orphaned vectors measured on reinstall, because the cuid is regenerated. Fixed on the
   unmerged `fix/vector-namespace-on-github-id`.

---

## A8. Indexer prune safety

`inngest/functions.ts`.

1. **Does prune only run after a fully successful upsert? — CONFIRMED YES.** Steps are strictly
   sequential and a step throw aborts the run: `upsert-chunks` L259-265, then
   `prune-stale-chunks` L270-280, then `mark-indexed` L282-287. There is no `try/catch` around
   either. **Correct.**
2. **Are deletes batched under Pinecone's per-call limit? — CONFIRMED YES.**
   `lib/pinecone.ts` `deleteVectorsById` chunks at `DELETE_BATCH = 1000`. Correct for
   `deleteMany({ ids })`.
3. **Is the stale set a set difference against the new ids? — CONFIRMED YES.**
   `const keep = new Set(records.map(r => r.id))` then `existing.filter(id => !keep.has(id))`
   (L271-273). Correct, and prefix-scoped via `repositoryVectorPrefix` so it cannot reach a
   neighbouring repository.
4. **Is an empty list right after upsert trusted? — CONFIRMED NO, and this is a real risk.**
   Pinecone list is **eventually consistent**: vectors written by `upsert-chunks` may not be
   visible to `listPaginated` in the immediately following step. If the listing returns a
   truncated or empty prefix, `existing.filter(...)` yields few or zero stale ids — the
   *conservative* direction, so it will not delete live vectors, but it **will silently under-
   prune**: chunks of deleted files and high chunk indexes of shrunken files survive and skew
   retrieval, which is exactly the bug the original delete-everything step was meant to avoid.
   There is no verification step and no counter surfaced to the caller beyond `pruned`
   (L279, L294). Part B item 11 should add a sanity assertion.
   **Mitigating fact:** `deleteRepositoryVectors` (used by the removal path) deletes by explicit
   id list, so it has the same dependency but the failure mode there is a leftover, not data loss.
5. **Related CONFIRMED bug already found and fixed on a pending branch:** `LIST_PAGE` was set to
   1000 while Pinecone caps a list page at **100**, returning HTTP 400
   `Limit must be greater than 0 and less than or equal to 100`. This made **every**
   `prune-stale-chunks` step fail, which is why an index run was observed stuck at `INDEXING`.

---

## A9. Schema

`src/prisma/contract.prisma`.

1. **Is there an index supporting the review list query? — CONFIRMED NO.**
   `PullRequestReview` (L52-71) has `@@unique([githubRepositoryId, githubPrNumber])` (L69) and
   `@@index([repositoryId])` (L70). The list query in `app/api/pull-requests/route.ts` filters
   `repositoryId.in(...)` and orders `updatedAt desc, id desc` with a keyset cursor. A
   single-column index cannot serve that ordering, so Postgres will sort the whole filtered set
   per page. Correctness is fine; it degrades linearly with review count.
   **Wanted: `@@index([repositoryId, updatedAt, id])`.**
2. **Where are findings stored? — CONFIRMED: only inside `reviewBody` text.**
   `reviewBody String?` (L64). There is no structured finding anywhere. Severity, file, line and
   evidence are only expressible by the Markdown the model wrote, so nothing downstream can
   query, filter, count, dedupe or re-verify a finding without re-parsing prose. This is the
   single biggest structural blocker for Part C items 1, 2, 3 and 5.
3. **Does anything store GitHub comment ids or check run ids? — CONFIRMED NO.**
   No `githubCommentId`, no `checkRunId`, no comment-update path. `post-github-comment`
   (`inngest/review-pull-request.ts`) returns the comment URL in its **step output only** — it is
   not persisted, so a re-review on a new push cannot find and update the previous comment and
   will duplicate it. Directly blocks Part C item 2.
4. **No `RunEvent` table** exists, so the future live timeline has no store. No `Finding` table.
   No per-installation settings table.
5. **Not an issue:** `GitHubRepository.githubRepositoryId @unique` (L31) is the correct identity
   anchor; `indexError String?` (L42) exists and is written by the indexer.

---

## A10. Branch state

`origin/main` is `d6167aa`. Diffing each branch **against main** (not against its own base)
separates "unmerged work" from "stale base":

| Branch | Net-new work vs main | Status |
|---|---|---|
| `fix/sync-keeps-repository-links` (`4979796`) | none | **Fully merged** (PR #4 → `aa4af5c`). |
| `fix/review-pagination-and-indexer-safety` (`49b378b`) | none | **Fully merged by content** via PR #3/#4 and the cherry-picked suspend fix (`6837abf`, PR #5). Diffing it against main shows only *deletions* of newer main work. |
| `fix/installation-suspend-action` (`6837abf`) | none | **Fully merged** (PR #5). |
| `fix/inngest-step-output-visibility` (`ff4e489`) | none | **Fully merged by content** via PR #6 → `726fbcf`, then re-landed as `a186374` inside `fix/fast-reviews-and-activity-errors`. |
| `fix/fast-reviews-and-activity-errors` (`26d326b`) | none | **Fully merged** (PR #7 → `7001869`). |
| `fix/app-permission-preflight` (`7d48cb9`) | none | **Fully merged** (PR #10 → `d6167aa`). |
| `fix/webhook-sync-off-request-path` (`f47ca1e`) | `inngest/sync-installation.ts` (+39 new), webhook route (+11/−2), inngest route (+3/−1) | **UNMERGED** |
| `fix/vector-namespace-on-github-id` (`dcb7c24`) | `lib/pinecone.ts`, `inngest/functions.ts`, `inngest/review-pull-request.ts`, `sync-installation.ts` — the namespace change | **UNMERGED** |

**This contradicts the brief.** Six of the eight branches carry **no** unmerged work — they were
merged as PRs #3–#7 and #10, and the tips still exist only because they were cut from an older
`main`. **Merging them again would revert newer work** (the activity-route error handling, the
heatmap message, the fast-model default and `app:check` all show as deletions). They should be
treated as historical and left alone.

**Conflicts between the two live branches: none.** They touch disjoint concerns — A8 concerns
`fix/vector-namespace-on-github-id`, A4 concerns `fix/webhook-sync-off-request-path`. Both edit
`inngest/` but different files.

**Recommended merge order:**

1. `fix/vector-namespace-on-github-id` first. It fixes a **live 400** (`LIST_PAGE` 1000 > 100)
   that is currently failing every `prune-stale-chunks` step, and it stops vector loss on
   reinstall. Highest operational risk.
2. `fix/webhook-sync-off-request-path` second. It removes the 500s GitHub records and is
   independent of the first.

Then `chore/agentic-review-foundations` branches from the updated `main`.

---

## Summary of confirmed defects

| # | Defect | Severity | Branch |
|---|---|---|---|
| 1 | `LIST_PAGE` 1000 > Pinecone's 100 → every prune step 400s | **High, live** | `fix/vector-namespace-on-github-id` |
| 2 | Vector namespace keyed on regenerated cuid → 552 vectors orphaned on reinstall | **High, live** | `fix/vector-namespace-on-github-id` |
| 3 | `syncInstallation` inline → ~36 s, over GitHub's 10 s webhook limit | **Medium** | `fix/webhook-sync-off-request-path` |
| 4 | Install callback blocks ~36 s on a browser redirect | Medium | not fixed |
| 5 | 8000/1500 char caps with no coverage statement | **High, quality** | Part B 4 |
| 6 | `listFiles` not paginated past 100 | Medium | Part B 4 |
| 7 | Diff given to model (8 k) differs from diff embedded (6 k) | Low | Part B 4 |
| 8 | Review ignores `indexStatus`; runs contextless silently | Medium | Part B 5 |
| 9 | Indexing never auto-queued on install | Medium | Part B 5 |
| 10 | `app:check` verifies `issues: write`, which does not govern PR comments | Medium | Part B 12 |
| 11 | `app:check` trusts `x-accepted-github-permissions`, which is not a grant list | Medium | Part B 12 |
| 12 | `syncInstallation` bumps `updatedAt` on every row every sync | Low | Part B 11 |
| 13 | No auto-relink of orphaned reviews on repo re-add | Low | Part B 11 |
| 14 | Prune trusts an eventually-consistent listing | Medium | Part B 11 |
| 15 | No composite index for the review list query | Medium | Part B 11 |
| 16 | Findings exist only as prose; no structured store | **High, structural** | Part B 2 |
| 17 | No comment/check id persisted → re-reviews duplicate comments | Medium | Part B 2 |
| 18 | PR tags unescaped → diff can close `<diff>` early | Low | Part B 1 |
| 19 | No verification that event `githubRepositoryId` belongs to event `installationId` | Low | Part B 9 |
| 20 | Orphaned reviews invisible in read routes | Low | Part B 9 |

**Not issues:** tenancy on every user-facing route; the injection instruction at
`lib/agent-review.ts:97`; prompt assembly and transport; upsert behaviour on transfer; prune
ordering and batching; GitHub signature verification; the four-branch stack premise.