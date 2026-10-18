import { Suspense } from "react";

import { requireAuth } from "@/features/auth/session";
import { RepoChat } from "@/features/repo-chat/repo-chat";

// Reads the session cookie and the repository, both request-time reads.
export const instant = false;

export default async function ChatPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    // Not covered by the proxy matcher, which matches /dashboard exactly.
    await requireAuth();

    const { id } = await params;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        Chat
                    </p>
                    <p className="text-sm">
                        Grounded in this repository, with citations.
                    </p>
                </div>
            </div>

            <div className="min-h-0 flex-1">
                <Suspense
                    fallback={
                        <p className="p-6 text-sm text-muted-foreground">
                            Loading chat...
                        </p>
                    }
                >
                    <RepoChat id={id} />
                </Suspense>
            </div>
        </div>
    );
}