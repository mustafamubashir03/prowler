# Prowler

Indexes your repositories into a vector store, then reviews every pull request
using that context and posts the review back on the PR.

Right now it indexes through GitHub's git tree API, embeds each chunk with Jina,
stores vectors in Pinecone, and generates reviews through the Claude Agent SDK
routed at OpenRouter. Background work runs on Inngest, so indexing and reviewing
happen off the request.

## Stack

| | |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | PostgreSQL via Prisma 8 in its query-builder style (there is no `PrismaClient`) |
| Auth | Better Auth with GitHub OAuth |
| UI | Tailwind v4, shadcn/ui on Base UI, TanStack Query |
| Background jobs | Inngest |
| Vector store | Pinecone |
| Embeddings | Jina `jina-embeddings-v3`, 1024 dimensions |
| Review model | Claude Agent SDK pointed at OpenRouter |
| Icons | Hugeicons |

## Getting it running

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Three processes are involved locally and they all need to be running for the
full flow to work:

```bash
pnpm dev                       # the app on :3000
npx inngest-cli@latest dev     # the Inngest dev server on :8288
ngrok http 3000 --domain=<your-domain>
```

The last one is not optional if you want to test webhooks. GitHub has to make an
inbound request to you, and it cannot reach `localhost`. Point it at:

```
https://<your-domain>/api/github/webhooks/github
```

with the same secret you put in `GITHUB_WEBHOOK_SECRET`.

Two things that catch people out with ngrok:

- Pass `--domain`. Without it you get a random subdomain on every restart and
  GitHub silently stops delivering to the old URL.
- Check which port it points at. `ngrok http 80` looks fine in the terminal but
  forwards to whatever Windows is holding port 80, which is usually nothing. It
  has to be 3000.

## Environment

| Variable | What it does |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Signs session cookies |
| `BETTER_AUTH_URL` | Public base URL |
| `GITHUB_APP_ID` | App id, used for JWTs |
| `GITHUB_APP_CLIENT_ID` | Client id, used for both OAuth and JWTs |
| `GITHUB_APP_CLIENT_SECRET` | OAuth exchange and token refresh |
| `GITHUB_APP_PRIVATE_KEY` | RS256 key for JWTs. Inline PEM, newlines are fine escaped as `\n` |
| `GITHUB_APP_SLUG` | The app's URL slug |
| `GITHUB_WEBHOOK_SECRET` | Verifies the `x-hub-signature-256` header |
| `INNGEST_EVENT_KEY` | Not needed with `INNGEST_DEV=1` |
| `INNGEST_SIGNING_KEY` | Not needed with `INNGEST_DEV=1` |
| `JINA_API_KEY` | Embeddings |
| `PINECONE_API_KEY` | Vector store |
| `PINECONE_INDEX_NAME` | Must already exist at 1024 dimensions, cosine |
| `OPENROUTER_API_KEY` | Review model, sent as the Anthropic auth token |
| `AGENT_MODEL` | Optional, overrides the model below |
| `NEXT_PUBLIC_APP_URL` | Base URL for post-install redirects |

`.env.example` lists all of them.

## How the flow works

**Installing.** `/api/github/install` redirects into GitHub's installation flow,
GitHub sends the user back to `/api/github/callback`, and the callback syncs every
repository the installation can reach. A GitHub App, so nothing is requested the
user did not grant.

**Indexing.** `POST /api/repositories/[id]/index` queues an Inngest run. It
resolves the default branch, walks the git tree, drops vendored and build paths,
skips anything over 100KB, chunks each file at 2000 characters and upserts one
vector per chunk. Chunk ids are `{repositoryId}:{path}:{chunkIndex}`, which makes
re-indexing idempotent.

Vectors for the repository are deleted before the upsert. Without that, chunks
for deleted files and the trailing indexes of files that got shorter stay in
Pinecone forever and quietly skew retrieval. The cost is a window where the
repository has no vectors at all.

**Reviewing.** A `pull_request` webhook queues a second run. It lists the PR
files, builds a diff, embeds the diff and pulls the closest chunks from Pinecone
for that repository, asks the model for a review, stores it, and posts it.

Events are keyed on repository, PR number and head SHA. GitHub redelivers
webhooks, so without a key every redelivery re-reviewed the PR and posted
another comment.

The review is stored before it is posted. Posting needs a write permission the
App may not have, and losing a review that was already generated and paid for
because a comment 403'd is the wrong trade.

## Review model

Default is `nvidia/nemotron-3.5-lightning:free`. Set `AGENT_MODEL` to change it.

Three free models were run against the same real payload, a 24-file PR at 21,463
characters:

| Model | Time | Output | Contract |
| --- | --- | --- | --- |
| `nvidia/nemotron-3.5-lightning:free` | 29s | 9,522 chars | 4/4 |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 5s | 501 chars | 0/4, truncated |
| `poolside/laguna-s-2.1:free` | 734s | failed | 0/4 |

The contract matters more than the speed here. Lightning was not the fastest, but
it was the only one that returned a review with all four sections, and the
dashboard renders those sections directly. Nemotron Ultra came back in five
seconds with half a kilobyte of text that did not follow the format at all.

`poolside/laguna-s-2.1:free` retires on 2026-10-31 with no replacement announced,
which is why it had to move regardless.

The agent is pointed at OpenRouter with the Anthropic-compatible base URL, and
`ANTHROPIC_API_KEY` is deliberately blanked so the SDK uses the routed token
rather than looking for a real Anthropic key. The default model aliases point
every slot at the same model.

Expect a review to take somewhere around 30 seconds. The 5-minute abort this had
earlier was not enough for a large PR, because the free models are genuinely slow
on long prompts. It now aborts at 20 minutes and the diff is capped at 12,000
characters.

Reviews are asked for in four sections: Overview, Changes, Suggestions, and a
Verdict. Suggestions are tagged Blocker, Major, Minor or Nit, and the system
prompt treats the diff as untrusted text rather than instructions.

## Permissions

The App needs:

- `Contents: Read and write` to read the tree and file contents
- `Metadata: Read-only`
- `Pull requests: Read-only` to list PR files and diffs
- `Issues: Read and write` to post the review

That last one is easy to miss. The comment is created through the issues API, so
without the Issues write permission the review is still generated, stored, and
shown on the Pull requests tab, but never appears on GitHub. There is a log line
when it happens:

```
[review] PR comment not posted (403); the review is still saved on the dashboard
```

Changing app permissions means the installation has to accept them again.

## Webhooks

Delivered to `/api/github/webhooks/github`, verified with HMAC-SHA256 against
`GITHUB_WEBHOOK_SECRET`. A bad signature gets a 401 and the request is dropped.

| Event | What happens |
| --- | --- |
| `installation` created, unsuspend, new_permissions_accepted | repositories are re-synced |
| `installation` deleted | the local installation is removed |
| `installation` suspended | marked suspended |
| `installation_repositories` | repositories are re-synced |
| `pull_request` opened, synchronize, reopened | a review is queued |

The heatmap needs no webhook. It reads the contribution graph live.

## Routes

Everything under `/api` except the webhook and the install redirect requires a
session and returns 401 without one.

| Route | |
| --- | --- |
| `GET /api/activity` | GitHub contributions, `?year=YYYY` optional |
| `GET /api/overview` | Dashboard counts |
| `GET /api/pull-requests` | Stored reviews |
| `GET /api/repositories` | `search`, `sort`, `cursor`, `offset` |
| `POST /api/repositories/[id]/index` | Queue an index run |
| `GET /api/github/callback` | Finish installing |
| `POST /api/github/webhooks/github` | Webhook receiver |
| `GET/POST/PUT /api/inngest` | Inngest serve |

`sort` is a combined token, `key:direction`, one of `name`, `updated` or
`status`, and `asc` or `desc`. So `sort=updated:desc`. An unrecognised value
falls back to `name:asc` rather than erroring.

## Dashboard behaviour

Search runs in SQL as an `ILIKE` against the full repository name. Sorting runs in
the query, not the browser.

Name ordering pages with a keyset cursor. Updated and status do not, because those
columns are not unique and a keyset cursor over a non-unique column skips or
repeats rows. Those page by offset instead, which Prisma 8 has no `.skip()` for,
so the slice happens in the route.

On a phone the repository table hides Visibility below `sm` and Default branch
below `md`, so the index action stays reachable, and the table scrolls inside its
own container instead of widening the page.

Client data is cached in TanStack Query. Default queries go stale after 30
seconds, so switching tabs does not refetch. Contributions are held for 5 minutes
because they only change when you commit. Indexing, disconnecting and starting a
review are mutations that invalidate the affected keys. Polling only runs while
something is actually in flight, so an idle dashboard makes no requests.

## Database

Migrations are files under `migrations/app/`, run through the Prisma 8 tooling
rather than `prisma migrate`:

```bash
pnpm exec prisma migrate status
pnpm exec prisma migrate check
pnpm exec prisma db verify
```

Better Auth keeps its tables in its own `auth` schema so Prisma owns `public` on
its own. It reads and writes those tables itself through its Kysely adapter.
`pnpm auth:migrate` syncs that schema.

Note that `indexedAt` and `updatedAt` are `TimestamptzString`, not `Date`. Prisma 8
returns timestamps as strings, so pass `new Date().toISOString()` rather than a
`Date`.

## Layout

```
app/                 routes and API handlers
  api/               the endpoints listed above
components/          UI, including the button and heatmap primitives
features/
  auth/              sign-in, session, GitHub App client, webhook sync
  dashboard/         the four tabs
inngest/             client, indexer, PR reviewer
lib/                 embeddings, Pinecone, the review agent
migrations/          Prisma 8 migration files
```

## Scripts

```bash
pnpm dev             # dev server
pnpm build           # production build
pnpm lint            # eslint
pnpm auth:migrate    # sync the auth schema
```

Type check separately with `pnpm exec tsc --noEmit`.

## Deploying

The app needs a public HTTPS URL, which means the webhook works without a tunnel
and the Inngest keys become required:

```
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

Set those in the host, then point the App's webhook URL at
`https://your-domain/api/github/webhooks/github`. Pinecone, Jina and OpenRouter
need no network access beyond outbound HTTPS.

Long review runs will hit hostless function timeouts. The 20 minute abort is
there for the model; the surrounding function timeout has to be longer than that
or the run is killed before the model finishes.