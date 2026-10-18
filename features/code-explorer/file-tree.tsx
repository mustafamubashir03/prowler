"use client";

import { useMemo, useState } from "react";

import { useRepoTree, type TreeFile } from "@/features/code-explorer/use-repo-tree";

type Directory = {
    name: string;
    children: Map<string, Directory | TreeFile>;
};

/**
 * GitHub returns a recursive tree as a flat path list. Large repositories have
 * tens of thousands of entries, so they are only expanded where the user has
 * opened a folder rather than rendered as a full tree up front.
 */
function buildTree(files: TreeFile[]) {
    const root: Directory = { name: "", children: new Map() };

    for (const file of files) {
        const segments = file.path.split("/");
        let node = root;

        for (let i = 0; i < segments.length - 1; i += 1) {
            const name = segments[i];
            const existing = node.children.get(name);

            if (existing && "children" in existing) {
                node = existing;
                continue;
            }

            const directory: Directory = { name, children: new Map() };
            node.children.set(name, directory);
            node = directory;
        }

        node.children.set(segments.at(-1)!, file);
    }

    return root;
}

function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileTree({
    id,
    selected,
    onSelect,
}: {
    id: string;
    selected: string | null;
    onSelect: (file: TreeFile) => void;
}) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState("");

    const { data, isLoading, isError, error } = useRepoTree(id);

    const root = useMemo(
        () => (data ? buildTree(data.files) : null),
        [data],
    );

    const matches = useMemo(() => {
        if (!data) return null;
        const needle = filter.trim().toLowerCase();

        if (!needle) return null;
        return data.files.filter((file) =>
            file.path.toLowerCase().includes(needle),
        );
    }, [data, filter]);

    function toggle(path: string) {
        setExpanded((current) => {
            const next = new Set(current);

            if (next.has(path)) next.delete(path);
            else next.add(path);

            return next;
        });
    }

    function renderNode(node: Directory, prefix: string): React.ReactNode {
        const entries = [...node.children.entries()].sort(([a], [b]) => {
            const aDir = "children" in node.children.get(a)!;
            const bDir = "children" in node.children.get(b)!;

            if (aDir !== bDir) return aDir ? -1 : 1;
            return a.localeCompare(b);
        });

        return entries.map(([name, child]) => {
            const path = prefix ? `${prefix}/${name}` : name;

            if ("children" in child) {
                const isOpen = expanded.has(path);

                return (
                    <li key={path}>
                        <button
                            type="button"
                            onClick={() => toggle(path)}
                            className="flex w-full items-center gap-1.5 px-2 py-1 text-left font-mono text-xs hover:bg-accent-ink/6"
                            aria-expanded={isOpen}
                        >
                            <span aria-hidden className="w-3 shrink-0 text-muted-foreground">
                                {isOpen ? "▾" : "▸"}
                            </span>
                            {name}
                        </button>
                        {isOpen && (
                            <ul className="ml-3 border-l border-border">
                                {renderNode(child, path)}
                            </ul>
                        )}
                    </li>
                );
            }

            const isSelected = selected === child.path;

            return (
                <li key={child.path}>
                    <button
                        type="button"
                        onClick={() => onSelect(child)}
                        title={`${child.path} · ${formatSize(child.size)}`}
                        className={`flex w-full items-center justify-between gap-2 px-2 py-1 text-left font-mono text-xs hover:bg-accent-ink/6 ${
                            isSelected
                                ? "bg-accent-ink/10 text-foreground"
                                : "text-muted-foreground"
                        }`}
                    >
                        <span className="truncate">{name}</span>
                        <span className="shrink-0 text-[10px] opacity-60">
                            {formatSize(child.size)}
                        </span>
                    </button>
                </li>
            );
        });
    }

    return (
        <div className="flex h-full flex-col border-r border-border">
            <div className="border-b border-border p-3">
                <input
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    placeholder="Filter files"
                    className="h-8 w-full border border-input bg-background px-2 font-mono text-xs outline-none focus-visible:border-primary"
                    aria-label="Filter files"
                />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-2">
                {isLoading && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                        Loading tree...
                    </p>
                )}

                {isError && (
                    <p className="px-3 py-2 text-sm text-destructive">
                        {error instanceof Error
                            ? error.message
                            : "Could not load the tree."}
                    </p>
                )}

                {data?.truncated && (
                    <p className="border-b border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
                        GitHub truncated this tree. Some files may be missing.
                    </p>
                )}

                {matches ? (
                    <ul>
                        {matches.map((file) => (
                            <li key={file.path}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(file)}
                                    className="w-full px-2 py-1 text-left font-mono text-xs text-muted-foreground hover:bg-accent-ink/6"
                                >
                                    {file.path}
                                </button>
                            </li>
                        ))}
                        {matches.length === 0 && (
                            <li className="px-3 py-2 text-sm text-muted-foreground">
                                No files match.
                            </li>
                        )}
                    </ul>
                ) : (
                    root && <ul>{renderNode(root, "")}</ul>
                )}
            </div>
        </div>
    );
}