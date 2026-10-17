"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, useState } from "react";

export function QueryProvider({
    children,
}: PropsWithChildren) {
    // Tab panels unmount on switch, so a zero staleTime refetches every tab each
    // time it is opened. A short staleTime keeps the cached payload warm across
    // switches, while mutations still invalidate immediately.
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 30_000,
                        gcTime: 5 * 60_000,
                        refetchOnWindowFocus: false,
                        retry: 1,
                    },
                },
            }),
    );
    return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}