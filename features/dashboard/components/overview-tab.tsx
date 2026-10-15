"use client";

import { useQuery } from "@tanstack/react-query";

type User = {
    name: string;
    email: string;
};

async function fetchOverview() {
    const response = await fetch("/api/overview");
    return response.json();
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
}: {
    label: string;
    value: number;
    hint?: string;
}) {
    return (
        <div className="flex flex-col gap-1 border border-border bg-card p-4">
            <SectionLabel>{label}</SectionLabel>
            <p className="font-mono text-2xl leading-none tabular-nums">{value}</p>
            {hint && (
                <p className="text-xs text-muted-foreground">{hint}</p>
            )}
        </div>
    );
}

export function OverviewTab({ user }: { user: User }) {
    const { data, isLoading } = useQuery({
        queryKey: ["overview"],
        queryFn: fetchOverview,
    });

    const stats = data?.stats ?? {
        installations: 0,
        repositories: 0,
        indexedRepositories: 0,
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
            ) : (
                <>
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
                        />
                        <StatCell
                            label="Reviews"
                            value={stats.completedReviews}
                            hint={`${stats.pullRequestReviews} total`}
                        />
                    </div>

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
                                                    className="block px-5 py-3 hover:bg-accent/40"
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