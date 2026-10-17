"use client";

import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";

type Review = {
    id: string;
    githubPrNumber: number;
    fullName: string;
    title: string;
    author: string;
    prUrl: string;
    status: string;
    reviewBody: string | null;
    updatedAt: string;
};

async function fetchReviews() {
    const response = await fetch("/api/pull-requests");
    if (!response.ok) throw new Error("Failed to load pull requests");
    return response.json() as Promise<{ reviews: Review[] }>;
}

function StatusBadge({ status }: { status: string }) {
    const failed = status === "FAILED";
    const done = status === "COMPLETED";

    return (
        <span
            className={`inline-flex items-center border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] ${
                failed
                    ? "border-destructive/40 text-destructive"
                    : done
                      ? "border-primary/40 text-primary"
                      : "border-border text-muted-foreground"
            }`}
        >
            {status.replace(/_/g, " ")}
        </span>
    );
}

export function PullRequestsTab() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["pull-requests"],
        queryFn: fetchReviews,
        placeholderData: (previous) => previous,
    });

    const reviews = data?.reviews ?? [];

    return (
        <div className="flex flex-col">
            <div className="border-b border-border px-5 py-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Pull requests
                </p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                    <h2 className="text-xl font-semibold tracking-tight">
                        Review activity
                    </h2>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {reviews.length} shown
                    </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    Every review Prowler posts, with its current status.
                </p>
            </div>

            {isLoading ? (
                <div className="flex flex-col">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <Skeleton
                            key={index}
                            className="h-16 w-full rounded-none border-b border-border"
                        />
                    ))}
                </div>
            ) : isError ? (
                <p className="px-5 py-6 text-sm text-destructive">
                    Could not load reviews.
                </p>
            ) : reviews.length === 0 ? (
                <div className="m-5 border border-dashed border-border bg-card px-6 py-12">
                    {/* One wrapper owns the measure and the centering, so the
                        heading and the body share a single centre line. */}
                    <div className="mx-auto max-w-md text-center">
                        <p className="font-medium">No reviews yet</p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            Open a pull request on a connected repository and
                            Prowler will review it.
                        </p>
                    </div>
                </div>
            ) : (
                <ul>
                    {reviews.map((review) => (
                        <li key={review.id} className="border-b border-border last:border-b-0">
                            <a
                                href={review.prUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block px-5 py-4 transition-colors hover:bg-accent-ink/6"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-mono text-xs text-muted-foreground">
                                            {review.fullName} #
                                            {review.githubPrNumber}
                                        </p>
                                        <h3 className="mt-1 text-sm font-medium">
                                            {review.title}
                                        </h3>
                                        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                                            {review.author} ·{" "}
                                            {new Date(review.updatedAt).toLocaleString()}
                                        </p>
                                    </div>
                                    <StatusBadge status={review.status} />
                                </div>

                                {review.reviewBody && (
                                    <p className="mt-3 whitespace-pre-wrap border-l border-border pl-4 text-sm leading-relaxed text-muted-foreground">
                                        {review.reviewBody}
                                    </p>
                                )}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
