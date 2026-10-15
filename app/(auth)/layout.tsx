import Link from "next/link";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AUTH_ROUTES } from "@/features/lib/routes";
import { Mark } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative flex flex-1 items-center justify-center px-4 py-16">
            <div className="pointer-events-none absolute inset-0 grid-lines opacity-60" />
            <div className="absolute right-4 top-4">
                <ThemeToggle />
            </div>

            <div className="relative w-full max-w-sm">
<Link
                    href={AUTH_ROUTES.landing}
                    className="mb-8 flex items-center gap-2.5 text-sm font-medium tracking-tight no-underline"
                    aria-label="Prowler"
                >
                    <Mark size={24} />
                    <span className="font-mono uppercase leading-none tracking-[0.2em]">
                        Prowler
                    </span>
                </Link>
                <div className="corner-ticks border border-border bg-card p-8 text-card-foreground">
                    {children}
                </div>
            </div>
        </div>
    );
}