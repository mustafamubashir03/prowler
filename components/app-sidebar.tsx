"use client"

import Link from "next/link"
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
    DashboardSquare01Icon,
    GitBranchIcon,
    RepositoryIcon,
    Settings05Icon,
} from "@hugeicons/core-free-icons"
import { Mark } from "@/components/brand/logo"

const navItems = [
    {
        id: "overview",
        title: "Overview",
        icon: DashboardSquare01Icon,
    },
    {
        id: "repositories",
        title: "Repositories",
        icon: RepositoryIcon,
    },
    {
        id: "pull-requests",
        title: "Pull Requests",
        icon: GitBranchIcon,
    },
    {
        id: "settings",
        title: "Settings",
        icon: Settings05Icon,
    },
] as const

export type DashboardTab = (typeof navItems)[number]["id"]

export function AppSidebar({
    activeTab,
    onTabChange,
    ...props
}: React.ComponentProps<typeof Sidebar> & {
    activeTab: DashboardTab
    onTabChange: (tab: DashboardTab) => void
}) {
    return (
        <Sidebar {...props}>
            <SidebarHeader className="border-b border-sidebar-border">
                <SidebarMenu>
                    <SidebarMenuItem>
<SidebarMenuButton size="lg" render={<Link href="/" />} className="h-auto py-2.5">
                            <Mark
                                size={24}
                                className="shrink-0 text-sidebar-accent-foreground"
                            />
                            <div className="flex flex-col leading-none">
                                <span className="text-sm font-medium tracking-tight">
                                    Prowler
                                </span>
                                <span className="font-mono text-[11px] text-muted-foreground">
                                    dashboard
                                </span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        Views
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => (
                                <SidebarMenuItem key={item.id}>
                                    <SidebarMenuButton
                                        isActive={activeTab === item.id}
                                        onClick={() => onTabChange(item.id)}
                                        className="rounded-none border-l-2 border-transparent data-active:border-l-primary data-active:bg-primary/10 data-active:text-accent-ink data-active:[&_svg]:text-accent-ink"
                                    >
                                        <HugeiconsIcon
                                            icon={item.icon}
                                            strokeWidth={1.5}
                                        />
                                        <span>{item.title}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarRail />
        </Sidebar>
    )
}