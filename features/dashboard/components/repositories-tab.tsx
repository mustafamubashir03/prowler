"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Globe } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Repository = {
    id: string;
    name: string;
    fullName: string;
    owner: string;
    private: boolean;
    defaultBranch: string;
    indexStatus: string;
    indexedAt: string | null;
};

async function fetchRepositories(search: string) {
    const response = await fetch(
        `/api/repositories${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    );
    if (!response.ok) throw new Error("Failed to load repositories");
    return response.json() as Promise<{
        repositories: Repository[];
        nextCursor: string | null;
    }>;
}

function IndexBadge({ status }: { status: string }) {
    const indexed = status === "INDEXED";
    const failed = status === "FAILED";

    return (
        <span
            className={`inline-flex items-center border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] ${
                indexed
                    ? "border-primary/40 text-primary"
                    : failed
                      ? "border-destructive/40 text-destructive"
                      : "border-border text-muted-foreground"
            }`}
        >
            {status.replace(/_/g, " ")}
        </span>
    );
}

export function RepositoriesTab() {
    const [search, setSearch] = useState("");

    const { data, isLoading, isError } = useQuery({
        queryKey: ["repositories", search],
        queryFn: () => fetchRepositories(search),
        placeholderData: (previous) => previous,
    });

    const repositories = data?.repositories ?? [];

    return (
        <div className="flex flex-col">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-6">
                <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Repositories
                    </p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight">
                        Connected repositories
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Synced from your GitHub App installations.
                    </p>
                </div>
                <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Filter by name"
                    className="w-full rounded-none sm:w-72"
                    aria-label="Filter repositories"
                />
            </div>

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
                    Could not load repositories.
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
                            <th className="px-5 py-2.5 text-left font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted-foreground">
                                Index status
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {repositories.map((repository) => (
                            <tr
                                key={repository.id}
                                className="border-b border-border transition-colors hover:bg-accent/40"
                            >
                                <td className="px-5 py-2.5">
                                    <span className="font-mono">{repository.fullName}</span>
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
                                <td className="px-5 py-2.5">
                                    <IndexBadge status={repository.indexStatus} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}