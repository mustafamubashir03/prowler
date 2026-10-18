"use client";

import { useQuery } from "@tanstack/react-query";

import { ActivityHeatmap } from "@/components/activity-heatmap";

type User = {
    name: string;
    email: string;
};

async function fetchOverview() {
    const response = await fetch("/api/overview");

    if (!response.ok) {
        throw new Error("Failed to load overview");
    }

    return response.json() as Promise<{
        stats: {
            installations: number;
            repositories: number;
            indexedRepositories: number;
            indexingRepositories: number;
            failedRepositories: number;
            pullRequestReviews: number;
            completedReviews: number;
        };
        recentReviews: {
            id: string;
            fullName: string;
            githubPrNumber: number;
            title: string;
            status: string;
            updatedAt: string;
            prUrl: string;
        }[];
        recentRepositories: {
            id: string;
            fullName: string;
            indexedAt: string | null;
        }[];
    }>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {children}
        </p>
    );
}

function StatCell({
    label,
    value,
    hint,
    accent = false,
}: {
    label: string;
    value: number;
    hint?: string;
    accent?: boolean;
}) {
    return (
        <div
            className={`flex flex-col gap-1 border border-border bg-card p-4 transition-colors hover:bg-accent-ink/6 ${
                accent ? "border-t-2 border-t-primary" : ""
            }`}
        >
            <SectionLabel>{label}</SectionLabel>
            <p
                className={`font-mono text-2xl leading-none tabular-nums ${
                    accent ? "text-accent-ink" : ""
                }`}
            >
                {value}
            </p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

export function OverviewTab({ user }: { user: User }) {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["overview"],
        queryFn: fetchOverview,
        // Indexing runs change these counts, so poll only while work is in
        // flight. Otherwise the default staleTime keeps the panel instant.
        refetchInterval: (query) => {
            const indexing =
                query.state.data?.stats.indexingRepositories ?? 0;

            return indexing > 0 ? 3000 : false;
        },
    });

    const stats = data?.stats ?? {
        installations: 0,
        repositories: 0,
        indexedRepositories: 0,
        indexingRepositories: 0,
        failedRepositories: 0,
        pullRequestReviews: 0,
        completedReviews: 0,
    };

    const recentReviews = data?.recentReviews ?? [];
    const recentRepositories = data?.recentRepositories ?? [];

    return (
        <div className="flex flex-col">
            <div className="border-b border-border px-5 py-6">
                <SectionLabel>Overview</SectionLabel>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                    Welcome back, {user.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Connected repositories, indexing status and review activity.
                </p>
            </div>

            {isLoading ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">
                    Loading overview...
                </p>
            ) : isError ? (
                <p className="px-5 py-6 text-sm text-destructive">
                    Could not load overview.
                </p>
            ) : (
                <>
                    {stats.indexingRepositories > 0 && (
                        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-3">
                            <span
                                aria-hidden
                                className="size-1.5 animate-pulse bg-accent-ink motion-reduce:animate-none"
                            />
                            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                                Indexing {stats.indexingRepositories}{" "}
                                {stats.indexingRepositories === 1
                                    ? "repository"
                                    : "repositories"}
                            </p>
                        </div>
                    )}

                    {stats.failedRepositories > 0 && (
                        <div className="flex items-center gap-2 border-b border-border bg-destructive/10 px-5 py-3">
                            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-destructive">
                                {stats.failedRepositories} failed to index · retry
                                from repositories
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-4">
                        <StatCell
                            label="Installations"
                            value={stats.installations}
                            hint="GitHub App connections"
                        />
                        <StatCell
                            label="Repositories"
                            value={stats.repositories}
                            hint="Synced from GitHub"
                        />
                        <StatCell
                            label="Indexed"
                            value={stats.indexedRepositories}
                            hint="Ready to review"
                            accent
                        />
                        <StatCell
                            label="Reviews"
                            value={stats.completedReviews}
                            hint={`${stats.pullRequestReviews} total`}
                        />
                    </div>

                    <ActivityHeatmap />

                    <div className="grid gap-px bg-border lg:grid-cols-2">
                        <section className="bg-background">
                            <div className="flex items-center justify-between border-b border-border px-5 py-3">
                                <h3 className="text-sm font-medium">
                                    Recent reviews
                                </h3>
                                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                                    {recentReviews.length}
                                </span>
                            </div>
                            {recentReviews.length === 0 ? (
                                <p className="px-5 py-6 text-sm text-muted-foreground">
                                    No reviews yet. Open a pull request on a connected
                                    repository.
                                </p>
                            ) : (
                                <ul>
                                    {recentReviews.map(
                                        (review: {
                                            id: string;
                                            fullName: string;
                                            githubPrNumber: number;
                                            title: string;
                                            status: string;
                                            updatedAt: string;
                                            prUrl: string;
                                        }) => (
                                            <li key={review.id} className="border-b border-border last:border-b-0">
                                                <a
                                                    href={review.prUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="block px-5 py-3 hover:bg-accent-ink/6"
                                                >
                                                    <p className="font-mono text-xs text-muted-foreground">
                                                        {review.fullName} #
                                                        {review.githubPrNumber}
                                                    </p>
                                                    <p className="mt-1 text-sm">
                                                        {review.title}
                                                    </p>
                                                    <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                                                        {review.status} ·{" "}
                                                        {new Date(
                                                            review.updatedAt,
                                                        ).toLocaleString()}
                                                    </p>
                                                </a>
                                            </li>
                                        ),
                                    )}
                                </ul>
                            )}
                        </section>

                        <section className="bg-background">
                            <div className="flex items-center justify-between border-b border-border px-5 py-3">
                                <h3 className="text-sm font-medium">
                                    Recently indexed
                                </h3>
                                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                                    {recentRepositories.length}
                                </span>
                            </div>
                            {recentRepositories.length === 0 ? (
                                <p className="px-5 py-6 text-sm text-muted-foreground">
                                    Nothing indexed yet. Indexing starts once a
                                    repository is connected.
                                </p>
                            ) : (
                                <ul>
                                    {recentRepositories.map(
                                        (repo: {
                                            id: string;
                                            fullName: string;
                                            indexedAt: string | null;
                                        }) => (
                                            <li
                                                key={repo.id}
                                                className="flex items-center justify-between border-b border-border px-5 py-3 last:border-b-0"
                                            >
                                                <p className="text-sm">{repo.fullName}</p>
                                                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                                                    {repo.indexedAt
                                                        ? new Date(
                                                              repo.indexedAt,
                                                          ).toLocaleString()
                                                        : "—"}
                                                </p>
                                            </li>
                                        ),
                                    )}
                                </ul>
                            )}
                        </section>
                    </div>
                </>
            )}
        </div>
    );
}
