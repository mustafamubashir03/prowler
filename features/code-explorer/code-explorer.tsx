"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { CodeEditor } from "@/features/code-explorer/code-editor";
import { FileTree } from "@/features/code-explorer/file-tree";
import {
    useRepoTree,
    type TreeFile,
} from "@/features/code-explorer/use-repo-tree";

export type FileResponse = {
    binary: boolean;
    tooLarge: boolean;
    size: number;
    maxBytes?: number;
    path: string;
    sha: string;
    language: string;
    content: string;
    lines: number;
};

async function fetchFile(
    id: string,
    path: string,
    sha: string | undefined,
): Promise<FileResponse> {
    const params = new URLSearchParams({ id, path });
    if (sha) params.set("sha", sha);

    const response = await fetch(`/api/repositories/${id}/file?${params}`);

    if (!response.ok) {
        throw new Error("Could not load the file");
    }

    return response.json() as Promise<FileResponse>;
}

/** `?line=12` or `?line=12-20`; anything else falls back to line 1 only. */
function parseRange(raw: string | null): [number, number] {
    if (!raw) return [1, 1];

    const match = /^(\d+)(?:-(\d+))?$/.exec(raw.trim());

    if (!match) return [1, 1];

    const start = Math.max(1, Number(match[1]));
    const end = match[2] ? Math.max(start, Number(match[2])) : start;

    return [start, end];
}

export function CodeExplorer({ id }: { id: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const path = searchParams.get("path");
    const [startLine, endLine] = parseRange(searchParams.get("line"));

    const { data: tree } = useRepoTree(id);
    const headSha = tree?.headSha;

    const { data: file, isLoading, isError, error } = useQuery({
        queryKey: ["repo-file", id, path, headSha],
        queryFn: () => fetchFile(id, path!, headSha),
        enabled: Boolean(path),
        // Content is immutable per commit sha, so the cache key already encodes
        // the version and a long stale time costs nothing.
        staleTime: 10 * 60_000,
        gcTime: 60 * 60_000,
        refetchOnWindowFocus: false,
    });

    const select = useCallback(
        (next: TreeFile) => {
            const params = new URLSearchParams();
            params.set("path", next.path);
            router.replace(`${pathname}?${params}`, { scroll: false });
        },
        [pathname, router],
    );

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        Code
                    </p>
                    <p className="truncate font-mono text-sm">
                        {path ?? "Select a file"}
                    </p>
                </div>
                {file && !file.binary && !file.tooLarge && hasContent(file) && (
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {file.lines} lines
                    </span>
                )}
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[280px_1fr]">
                <div className="min-h-[200px] md:min-h-0">
                    <FileTree id={id} selected={path} onSelect={select} />
                </div>

                <div className="min-h-[400px] md:min-h-0">
                    {!path && (
                        <p className="p-6 text-sm text-muted-foreground">
                            Pick a file to read it.
                        </p>
                    )}

                    {path && isLoading && (
                        <p className="p-6 text-sm text-muted-foreground">
                            Loading file...
                        </p>
                    )}

                    {path && isError && (
                        <p className="p-6 text-sm text-destructive">
                            {error instanceof Error
                                ? error.message
                                : "Could not load the file."}
                        </p>
                    )}

                    {file?.tooLarge && (
                        <p className="p-6 text-sm text-muted-foreground">
                            This file is {(file.size / (1024 * 1024)).toFixed(1)} MB,
                            over the {(file.maxBytes! / (1024 * 1024)).toFixed(0)} MB
                            viewer limit. Files this size are usually generated
                            bundles or data dumps.
                        </p>
                    )}

                    {file?.binary && (
                        <p className="p-6 text-sm text-muted-foreground">
                            This file is binary, so there is nothing to display.
                        </p>
                    )}

                    {file && !file.binary && !file.tooLarge && (
                        <CodeEditor
                            value={file.content}
                            language={file.language}
                            startLineNumber={startLine}
                            endLineNumber={endLine}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

function hasContent(file: FileResponse) {
    return file.content.length > 0;
}