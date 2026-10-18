"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown01Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { ReviewMarkdown } from "@/components/review-markdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type PullRequestReview = {
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

async function fetchPullRequests() {
  const response = await fetch("/api/pull-requests");

  if (!response.ok) {
    throw new Error("Failed to load pull requests");
  }

  return response.json() as Promise<{ reviews: PullRequestReview[] }>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

function StatusBadge({ status }: { status: string }) {
  const completed = status === "COMPLETED";
  const failed = status === "FAILED";
  const reviewing = status === "REVIEWING";

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] ${
        completed
          ? "border-primary/40 text-accent-ink"
          : failed
            ? "border-destructive/40 text-destructive"
            : "border-border text-muted-foreground"
      }`}
    >
      {reviewing && (
        <span
          aria-hidden
          className="size-1.5 animate-pulse bg-current motion-reduce:animate-none"
        />
      )}
      {status.replace(/_/g, " ")}
    </span>
  );
}

function PullRequestCard({
  review,
  open,
  onOpenChange,
}: {
  review: PullRequestReview;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hasReview = Boolean(review.reviewBody);
  const isReviewing = review.status === "REVIEWING";

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="border-b border-border"
    >
      <div className="flex items-start gap-3 px-3 py-4 sm:px-5">
        <CollapsibleTrigger
          aria-label={open ? "Collapse review" : "Expand review"}
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-border bg-background transition-colors hover:bg-accent-ink/6"
        >
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">
                {review.fullName} #{review.githubPrNumber}
              </p>
              <p className="mt-1 text-sm font-medium">{review.title}</p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                {review.author} ·{" "}
                {new Date(review.updatedAt).toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={review.status} />
              <a
                href={review.prUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 items-center gap-1 border border-border bg-background px-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-accent-ink/6 hover:text-foreground"
              >
                <HugeiconsIcon
                  icon={LinkSquare02Icon}
                  strokeWidth={2}
                  className="size-3.5"
                />
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>

      <CollapsibleContent className="border-t border-border px-3 pb-5 pt-4 sm:px-5">
        {hasReview ? (
          // Centred so the measure sits inside the card instead of hugging
          // the left edge and leaving a void on a wide screen.
          <div className="mx-auto w-full max-w-[80ch] border-l border-border pl-4">
            <ReviewMarkdown
              content={review.reviewBody!}
              isAnimating={isReviewing}
            />
          </div>
        ) : isReviewing ? (
          <p className="text-sm text-muted-foreground">
            Prowler is generating the review...
          </p>
        ) : review.status === "FAILED" ? (
          <p className="text-sm text-destructive">
            Review failed. Push a new commit or reopen the PR to retry.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No review content yet.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PullRequestsTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["pull-requests"],
    queryFn: fetchPullRequests,
    placeholderData: (previous) => previous,
    // Only poll while a review is actually being generated.
    refetchInterval: (query) => {
      const reviews = (query.state.data?.reviews ?? []) as PullRequestReview[];
      return reviews.some((review) => review.status === "REVIEWING")
        ? 3000
        : false;
    },
  });

  const reviews = (data?.reviews ?? []) as PullRequestReview[];
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  function isOpen(review: PullRequestReview, index: number) {
    if (review.id in openIds) {
      return openIds[review.id];
    }

    return review.status === "REVIEWING" || index === 0;
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-border px-5 py-6">
        <SectionLabel>Pull requests</SectionLabel>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Review activity</h2>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {reviews.length} shown
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Prowler reviews PRs automatically when they are opened or updated.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-16 w-full border-b border-border"
              aria-hidden
            />
          ))}
        </div>
      ) : isError ? (
        <p className="px-5 py-6 text-sm text-destructive">
          Could not load reviews.
        </p>
      ) : reviews.length === 0 ? (
        <div className="m-5 border border-dashed border-border bg-card px-6 py-12">
          <div className="mx-auto max-w-md text-center">
            <p className="font-medium">No reviews yet</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Open a PR on a connected repo and Prowler will post a review here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {reviews.map((review, index) => (
            <PullRequestCard
              key={review.id}
              review={review}
              open={isOpen(review, index)}
              onOpenChange={(open) =>
                setOpenIds((current) => ({ ...current, [review.id]: open }))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}