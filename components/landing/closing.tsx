import Link from "next/link";

import { AUTH_ROUTES } from "@/features/lib/routes";
import { Mark } from "@/components/brand/logo";
import { Label } from "./primitives";

export function Closing({ primaryCta }: { primaryCta: React.ReactNode }) {
    return (
        <section className="border-b border-border">
            <div className="shell py-24 lg:py-36">
                <div data-reveal style={{ "--i": 0 } as React.CSSProperties}>
                    <Label>Install</Label>
                    <h2 className="display mt-7 !max-w-none">
                        Get a review on your next pull request.
                    </h2>
                </div>

                <div
                    className="mt-10"
                    data-reveal
                    style={{ "--i": 1 } as React.CSSProperties}
                >
                    {primaryCta}
                </div>
            </div>
        </section>
    );
}

export function SiteFooter() {
    return (
        <footer>
            <div className="shell py-10">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                        href={AUTH_ROUTES.landing}
                        className="flex items-center gap-2.5 no-underline"
                        aria-label="Prowler"
                    >
                        <Mark size={20} />
                        <span className="font-mono text-[13px] uppercase leading-none tracking-[0.2em]">
                            Prowler
                        </span>
                    </Link>

                    <nav className="flex flex-wrap items-center gap-6">
                        <a
                            href="#how-it-works"
                            className="font-mono text-[13px] tracking-[0.08em] text-muted-foreground uppercase no-underline hover:text-foreground"
                        >
                            How it works
                        </a>
                        <a
                            href="#features"
                            className="font-mono text-[13px] tracking-[0.08em] text-muted-foreground uppercase no-underline hover:text-foreground"
                        >
                            Features
                        </a>
                        <a
                            href="#access"
                            className="font-mono text-[13px] tracking-[0.08em] text-muted-foreground uppercase no-underline hover:text-foreground"
                        >
                            Access
                        </a>
                    </nav>
                </div>
            </div>
        </footer>
    );
}