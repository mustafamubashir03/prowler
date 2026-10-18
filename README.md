# Prowler

A GitHub App that indexes your repositories and reviews every pull request with
the context of the whole codebase, then posts the review on the PR.

## How it works

1. **Install** the GitHub App on the account or organisation that owns your
   repositories. Webhook events arrive at
   `/api/github/webhooks/github` and are verified with HMAC-SHA256.
2. **Index** a repository. An Inngest function walks the git tree, skips vendored
   and generated paths, chunks each file at 2000 characters and upserts one
   vector per chunk into Pinecone. Embeddings come from Jina
   (`jina-embeddings-v3`, 1024 dimensions), which must match the index dimension
   and metric. Vectors for the repository are cleared first, so a re-index does
   not leave stale chunks behind for deleted or shortened files.
3. **Review** a pull request. A `pull_request` webhook triggers a second Inngest
   function that fetches the diff, retrieves related code from Pinecone, asks the
   model for a review, stores it, and posts it back to the PR.

## Review model

The agent runs through the Claude Agent SDK, pointed at OpenRouter using the
Anthropic-compatible base URL and auth token. `AGENT_MODEL` overrides the
default.

The default was chosen by benchmarking three free models on this project's own
review task, using an identical 21,463 character payload taken from a real
24-file pull request:

| Model | Time | Output | Output contract |
| --- | --- | --- | --- |
| `nvidia/nemotron-3.5-lightning:free` | 29s | 9,522 chars | 4 / 4 sections |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 5s | 501 chars | 0 / 4, truncated |
| `poolside/laguna-s-2.1:free` | 734s | failed | 0 / 4 |

Lightning is the only model that returned a usable review. Nemotron Ultra is
quicker but does not follow the output contract. `poolside/laguna-s-2.1:free`
retires on 2026-10-31 with no replacement announced.

## Activity heatmap

The Overview tab renders your real GitHub contribution graph, read from the
GitHub GraphQL API using the token stored on your connected account. The total,
the per-day counts and the cell colours all come straight from GitHub, so the
heatmap matches your profile exactly. Nothing is estimated. Selecting a year
re-queries that calendar.

## Repository list

Search and sorting run on the server. Search is a SQL `ILIKE` against the full
repository name. Sorting supports name, last updated and index status, ascending
or descending. Name ordering uses a keyset cursor; the other keys are not unique,
so those page by offset.

## Local development

```bash
pnpm install
pnpm dev
```

The Inngest dev server is required for background work locally:

```bash
npx inngest-cli@latest dev
```

GitHub cannot reach a local server, so expose it before testing webhooks:

```bash
ngrok http 3000 --domain=<your-domain>
```

Then set the App's webhook URL to `https://<your-domain>/api/github/webhooks/github`
using the same secret as `GITHUB_WEBHOOK_SECRET`.

### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Session signing |
| `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG` | GitHub App credentials |
| `GITHUB_WEBHOOK_SECRET` | Verifies inbound webhook signatures |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Inngest, or `INNGEST_DEV=1` locally |
| `JINA_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX_NAME` | Indexing |
| `OPENROUTER_API_KEY` | Review agent, routed through the Anthropic-compatible API |
| `AGENT_MODEL` | Optional model override |

## Permissions

The App needs `Contents: Read and write`, `Metadata: Read-only`, and
`Pull requests: Read-only` to index and read diffs. To post reviews as PR
comments it additionally needs **`Issues: Read and write`**, because the comment
is created through the issues API. Without it the review is still generated and
stored, and appears on the Pull requests tab, but is not posted to GitHub.

## Scripts

```bash
pnpm build      # production build
pnpm lint       # eslint
pnpm exec tsc --noEmit
pnpm auth:migrate
```