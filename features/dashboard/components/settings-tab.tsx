"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteInstallation } from "@/features/dashboard/actions/delete-installation";
import { GITHUB_ROUTES } from "@/features/lib/routes";

type User = {
    name: string;
    email: string;
    image?: string | null;
};

type Installation = {
    id: string;
    githubInstallationId: string;
    targetLogin: string;
    targetType: string;
    status: string;
    repositorySelection: string;
    repoCount: number;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {children}
        </p>
    );
}

export function SettingsTab({
    user,
    installations,
}: {
    user: User;
    installations: Installation[];
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const disconnect = (githubInstallationId: string, label: string) => {
        setError(null);
        startTransition(async () => {
            try {
                await deleteInstallation(githubInstallationId);
                router.refresh();
            } catch {
                setError(`Could not disconnect ${label}. Try again.`);
            }
        });
    };

    return (
        <div className="flex flex-col">
            <div className="border-b border-border px-5 py-6">
                <SectionLabel>Settings</SectionLabel>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                    Account and access
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Connected accounts and the repositories Prowler can read.
                </p>
            </div>

            {error && (
                <div className="border-b border-destructive/40 bg-destructive/10 px-5 py-3">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            )}

            <section className="border-b border-border">
                <div className="border-b border-border px-5 py-3">
                    <SectionLabel>Account</SectionLabel>
                </div>
                <dl className="grid gap-px bg-border sm:grid-cols-2">
                    <div className="bg-background px-5 py-4">
                        <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                            Name
                        </dt>
                        <dd className="mt-1 text-sm">{user.name}</dd>
                    </div>
                    <div className="bg-background px-5 py-4">
                        <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                            Email
                        </dt>
                        <dd className="mt-1 font-mono text-sm">{user.email}</dd>
                    </div>
                </dl>
            </section>

            <section>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
                    <SectionLabel>GitHub App installations</SectionLabel>
                    <Button
                        render={<a href={GITHUB_ROUTES.install} />}
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                        className="rounded-none"
                    >
                        Connect GitHub
                    </Button>
                </div>

                {installations.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-muted-foreground">
                        No installations yet. Connect GitHub to grant Prowler access
                        to your repositories.
                    </p>
                ) : (
                    <ul>
                        {installations.map((installation) => (
                            <li
                                key={installation.id}
                                className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 last:border-b-0"
                            >
                                <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                        {installation.targetLogin}
                                        <span className="border border-border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                                            {installation.targetType.toLowerCase()}
                                        </span>
                                        {installation.status !== "ACTIVE" && (
                                            <span className="border border-destructive/40 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-destructive">
                                                {installation.status.toLowerCase()}
                                            </span>
                                        )}
                                    </p>
                                    <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                                        {installation.repoCount} repos ·{" "}
                                        {installation.repositorySelection === "all"
                                            ? "all repositories"
                                            : "selected repositories"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        render={
                                            <a
                                                href={`https://github.com/apps/${installation.targetLogin}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                aria-label={`View ${installation.targetLogin} on GitHub`}
                                            />
                                        }
                                        nativeButton={false}
                                        variant="ghost"
                                        size="icon-sm"
                                        className="rounded-none"
                                    >
                                        <ExternalLink className="size-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-none"
                                        disabled={pending}
                                        onClick={() =>
                                            disconnect(
                                                installation.githubInstallationId,
                                                installation.targetLogin,
                                            )
                                        }
                                    >
                                        Disconnect
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}