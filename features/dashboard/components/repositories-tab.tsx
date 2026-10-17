"use client";

import { useEffect, useRef, useState } from "react";
import {
    keepPreviousData,
    useInfiniteQuery,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { Globe, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Repository = {
    id: string;
    fullName: string;
    private: boolean;
    defaultBranch: string;
    indexStatus: string;
    indexedAt: string | null;
    installation: {
        targetLogin: string | null;
    };
};

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {children}
        </p>
    );
}

async function fetchRepositories(search: string, cursor?: string) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(`/api/repositories?${params}`);

    if (!response.ok) {
        throw new Error("Failed to load repositories");
    }

    return response.json() as Promise<{
        repositories: Repository[];
        nextCursor: string | null;
    }>;
}

async function startIndexing(repositoryId: string) {
    const response = await fetch(`/api/repositories/${repositoryId}/index`, {
        method: "POST",
    });

    if (!response.ok) {
        throw new Error("Could not start indexing");
    }

    return response.json() as Promise<{ ok: boolean }>;
}

function IndexBadge({ status }: { status: string }) {
    const indexed = status === "INDEXED";
    const failed = status === "FAILED";
    const indexing = status === "INDEXING";

    return (
        <span
            className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] ${
                indexed
                    ? "border-primary/40 text-accent-ink"
                    : failed
                      ? "border-destructive/40 text-destructive"
                      : indexing
                        ? "border-border text-muted-foreground"
                        : "border-border text-muted-foreground"
            }`}
        >
            {indexing && (
                <span
                    aria-hidden
                    className="size-1.5 animate-pulse bg-current motion-reduce:animate-none"
                />
            )}
            {status.replace(/_/g, " ")}
        </span>
    );
}

function IndexAction({
    repository,
    onIndex,
    pending,
}: {
    repository: Repository;
    onIndex: (id: string) => void;
    pending: boolean;
}) {
    const { indexStatus } = repository;

    // The row already renders IndexBadge for every state, so the indexing row
    // must not repeat it here.
    if (indexStatus === "INDEXING") {
        return null;
    }

    if (pending) {
        return (
            <Button size="sm" variant="outline" disabled>
                Queuing...
            </Button>
        );
    }

    return (
        <Button
            size="sm"
            variant="outline"
            onClick={() => onIndex(repository.id)}
        >
            {indexStatus === "NOT_INDEXED" ? "Index" : "Re-index"}
        </Button>
    );
}

export function RepositoriesTab() {
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        error,
    } = useInfiniteQuery({
        queryKey: ["repositories", debouncedSearch],
        queryFn: ({ pageParam }) =>
            fetchRepositories(debouncedSearch, pageParam as string | undefined),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        placeholderData: keepPreviousData,
        // Only poll while a repository is actively indexing. The counts on the
        // overview tab change as runs land, so that cache is dropped too.
        refetchInterval: (query) => {
            const repositories =
                query.state.data?.pages.flatMap((page) => page.repositories) ??
                [];

            return repositories.some(
                (repository) => repository.indexStatus === "INDEXING",
            )
                ? 3000
                : false;
        },
    });

    const indexMutation = useMutation({
        mutationFn: startIndexing,
        onMutate: (repositoryId) => {
            setActionError(null);
            setPendingId(repositoryId);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["repositories"] });
            void queryClient.invalidateQueries({ queryKey: ["overview"] });
        },
        onError: () => {
            setActionError("Could not start indexing. Try again.");
        },
        onSettled: () => {
            setPendingId(null);
        },
    });

    const repositories =
        data?.pages.flatMap((page) => page.repositories) ?? [];

    useEffect(() => {
        const element = loadMoreRef.current;
        if (!element || !hasNextPage) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting && !isFetchingNextPage) {
                void fetchNextPage();
            }
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    return (
        <div className="flex flex-col">
            <div className="border-b border-border px-5 py-6">
                <SectionLabel>Repositories</SectionLabel>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                    <h2 className="text-xl font-semibold tracking-tight">
                        Connected repositories
                    </h2>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {repositories.length} loaded
                    </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    Synced from your GitHub App installations.
                </p>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-4">
                <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Filter by name"
                    type="search"
                    className="w-full rounded-none sm:w-72"
                    aria-label="Filter repositories"
                />
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Index a repository to make it searchable for reviews
                </p>
            </div>

            {actionError && (
                <p className="border-b border-destructive/40 bg-destructive/10 px-5 py-3 text-sm text-destructive">
                    {actionError}
                </p>
            )}

            {isLoading ? (
                <div className="flex flex-col">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton
                            key={index}
                            className="h-12 w-full rounded-none border-b border-border"
                        />
                    ))}
                </div>
            ) : isError ? (
                <p className="px-5 py-6 text-sm text-destructive">
                    {error instanceof Error
                        ? error.message
                        : "Could not load repositories."}
                </p>
            ) : repositories.length === 0 ? (
                <div className="m-5 border border-dashed border-border bg-card px-6 py-12">
                    <div className="mx-auto max-w-md text-center">
                        <p className="font-medium">
                            {search
                                ? "No repositories match that filter"
                                : "No repositories yet"}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {search
                                ? "Try a different search term."
                                : "Install the GitHub App on the account or organization that owns your repositories."}
                        </p>
                    </div>
                </div>
            ) : (
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="px-5 py-2.5 text-left font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted-foreground">
                                Repository
                            </th>
                            <th className="hidden px-5 py-2.5 text-left font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted-foreground md:table-cell">
                                Default branch
                            </th>
                            <th className="px-5 py-2.5 text-left font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted-foreground">
                                Visibility
                            </th>
                            <th className="px-5 py-2.5 text-right font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted-foreground">
                                Index status
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {repositories.map((repository) => (
                            <tr
                                key={repository.id}
                                className="border-b border-border transition-colors hover:bg-accent-ink/6"
                            >
                                <td className="px-5 py-2.5">
                                    <span className="font-mono">
                                        {repository.fullName}
                                    </span>
                                </td>
                                <td className="hidden px-5 py-2.5 font-mono text-xs text-muted-foreground md:table-cell">
                                    {repository.defaultBranch}
                                </td>
                                <td className="px-5 py-2.5">
                                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                                        {repository.private ? (
                                            <Lock className="size-3" aria-hidden />
                                        ) : (
                                            <Globe className="size-3" aria-hidden />
                                        )}
                                        {repository.private ? "private" : "public"}
                                    </span>
                                </td>
                                <td className="px-5 py-2.5 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-3">
                                        <IndexBadge
                                            status={repository.indexStatus}
                                        />
                                        <IndexAction
                                            repository={repository}
                                            pending={
                                                pendingId === repository.id
                                            }
                                            onIndex={(id) =>
                                                indexMutation.mutate(id)
                                            }
                                        />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            <div ref={loadMoreRef} className="h-4" aria-hidden />

            {isFetchingNextPage && (
                <p className="px-5 pb-4 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Loading more
                </p>
            )}
        </div>
    );
}
