"use client";

import { useQuery } from "@tanstack/react-query";

export type TreeFile = { path: string; type: string; sha: string; size: number };

export type TreeResponse = {
    headSha: string;
    truncated: boolean;
    files: TreeFile[];
};

async function fetchTree(id: string): Promise<TreeResponse> {
    const response = await fetch(`/api/repositories/${id}/tree`);

    if (!response.ok) {
        throw new Error("Could not load the repository tree");
    }

    return response.json() as Promise<TreeResponse>;
}

/**
 * One query definition shared by the tree pane and the editor pane.
 *
 * They must not each register their own queryFn under the same key: TanStack
 * keeps whichever mounted first, so a second, narrower fetch would leave the
 * other component reading a shape it did not expect.
 */
export function useRepoTree(id: string) {
    return useQuery({
        queryKey: ["repo-tree", id],
        queryFn: () => fetchTree(id),
        // A tree only changes when the default branch moves, so it is held far
        // longer than the default and is keyed by the repository, never the file.
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
    });
}