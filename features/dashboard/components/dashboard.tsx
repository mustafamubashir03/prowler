"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AppSidebar, type DashboardTab } from "@/components/app-sidebar";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { OverviewTab } from "@/features/dashboard/components/overview-tab";
import { PullRequestsTab } from "@/features/dashboard/components/pull-requests-tab";
import { RepositoriesTab } from "@/features/dashboard/components/repositories-tab";
import { SettingsTab } from "@/features/dashboard/components/settings-tab";

const tabLabels: Record<DashboardTab, string> = {
    overview: "Overview",
    repositories: "Repositories",
    "pull-requests": "Pull Requests",
    settings: "Settings",
};

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

export function Dashboard({
    user,
    installations,
}: {
    user: User;
    installations: Installation[];
}) {
    const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

    return (
        <SidebarProvider>
            <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
            <SidebarInset className="rounded-none">
                <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                        orientation="vertical"
                        className="mr-1 h-4 data-vertical:self-auto"
                    />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbPage className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                    {tabLabels[activeTab]}
                                </BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                    <div className="ml-auto flex items-center gap-3">
                        <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                            {user.email}
                        </span>
                        <ThemeToggle />
                        <SignOutButton />
                    </div>
                </header>
                <div className="flex flex-1 flex-col">
                    {activeTab === "overview" && <OverviewTab user={user} />}
                    {activeTab === "repositories" && <RepositoriesTab />}
                    {activeTab === "pull-requests" && <PullRequestsTab />}
                    {activeTab === "settings" && (
                        <SettingsTab user={user} installations={installations} />
                    )}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}