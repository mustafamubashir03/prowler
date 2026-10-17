"use client";


import { ReviewMarkdown } from "@/components/review-markdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowDown01Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

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
  return response.json();
}

function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED") {
    return (
      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
        Reviewed
      </span>
    );
  }

  if (status === "REVIEWING") {
    return (
      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
        Reviewing...
      </span>
    );
  }

  if (status === "FAILED") {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
        Failed
      </span>
    );
  }

  return (
    <span className="rounded-full bg-muted px-2.5 py-1 text-xs">Pending</span>
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
      className="rounded-2xl border bg-card"
    >
      <div className="flex items-start gap-3 p-4">
        <CollapsibleTrigger className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border bg-background transition-colors hover:bg-muted">
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">
                {review.fullName}{" "}
                <span className="text-muted-foreground">
                  #{review.githubPrNumber}
                </span>
              </p>
              <p className="mt-1 text-sm">{review.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                by {review.author} · updated{" "}
                {new Date(review.updatedAt).toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={review.status} />
              <a
                href={review.prUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 items-center gap-1 rounded-2xl border border-border bg-background px-3 text-sm hover:bg-muted"
              >
                <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} />
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>

      <CollapsibleContent className="border-t px-4 pb-4 pt-3">
        {hasReview ? (
          <div className="rounded-xl border bg-muted/20 p-4">
            <ReviewMarkdown
              content={review.reviewBody!}
              isAnimating={isReviewing}
            />
          </div>
        ) : isReviewing ? (
          <p className="text-sm text-muted-foreground">
            Prowl is generating the review...
          </p>
        ) : review.status === "FAILED" ? (
          <p className="text-sm text-destructive">
            Review failed. Push a new commit or reopen the PR to retry.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No review content yet.
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PullRequestsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["pull-requests"],
    queryFn: fetchPullRequests,
    refetchInterval: (query) => {
      const reviews = (query.state.data?.reviews ?? []) as PullRequestReview[];
      const isReviewing = reviews.some((review) => review.status === "REVIEWING");

      return isReviewing ? 3000 : false;
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
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold">Pull Requests</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Prowl reviews PRs automatically when they are opened or updated.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border bg-background p-8 text-center text-sm text-muted-foreground">
          Loading pull requests...
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-background p-12 text-center">
          <p className="text-lg font-medium">No reviews yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Open a PR on a connected repo and Prowl will post a review here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
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
