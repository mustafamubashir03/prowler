import { Suspense } from "react";

import { requireAuth } from "@/features/auth/session";
import { CodeExplorer } from "@/features/code-explorer/code-explorer";

// The viewer reads the session cookie and the repository's default branch, both
// request-time reads, so it cannot be prerendered into the static shell.
export const instant = false;

export default async function CodePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    // The proxy matcher only covers /dashboard exactly, so this route is not
    // covered by it and has to enforce its own session check.
    await requireAuth();

    const { id } = await params;

    return (
        <Suspense
            fallback={
                <p className="p-6 text-sm text-muted-foreground">Loading code...</p>
            }
        >
            <CodeExplorer id={id} />
        </Suspense>
    );
}