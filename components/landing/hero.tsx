import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AUTH_ROUTES } from "@/features/lib/routes";
import { Mark } from "@/components/brand/logo";
import { ThemeMenu } from "@/components/ui/theme-toggle";
import { Label } from "./primitives";
import { ReviewMock } from "./product-mock";

const NAV = [
    { href: "#how-it-works", label: "How it works" },
    { href: "#features", label: "Features" },
    { href: "#access", label: "Access" },
];

export function LandingNav({ isSignedIn }: { isSignedIn: boolean }) {
    return (
        <header className="sticky top-0 z-40 border-b border-border bg-background">
            <div className="shell flex h-16 items-center gap-8">
                {/* The mark is decorative: the wordmark already spells the name,
                    so exposing the mark too would read it twice. */}
                <Link
                    href={AUTH_ROUTES.landing}
                    className="flex items-center gap-2.5 no-underline"
                    aria-label="Prowler"
                >
                    <Mark size={22} />
                    <span className="font-mono text-[13px] uppercase leading-none tracking-[0.2em]">
                        Prowler
                    </span>
                </Link>

                <nav className="ml-auto hidden items-center gap-7 md:flex">
                    {NAV.map((item) => (
                        <a
                            key={item.href}
                            href={item.href}
                            className="font-mono text-[13px] tracking-[0.08em] text-muted-foreground uppercase no-underline hover:text-foreground"
                        >
                            {item.label}
                        </a>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-2 md:ml-0">
                    <ThemeMenu />
                    <Button
                        render={
                            <Link
                                href={
                                    isSignedIn
                                        ? AUTH_ROUTES.dashboard
                                        : AUTH_ROUTES.signIn
                                }
                            />
                        }
                        nativeButton={false}
                        size="lg"
                        className="rounded-none"
                    >
                        {isSignedIn ? "Open dashboard" : "Install on GitHub"}
                    </Button>
                </div>
            </div>
        </header>
    );
}
export function Hero({ primaryCta }: { primaryCta: React.ReactNode }) {
    return (
        <section className="relative overflow-hidden border-b border-border">
            <div
                aria-hidden
                className="grid-lines pointer-events-none absolute inset-0 opacity-60"
            />

            <div className="shell relative">
                <div className="pt-14 pb-10 lg:pt-20 lg:pb-14">
                    <div data-rise style={{ "--i": 0 } as React.CSSProperties}>
                        <Label>AI code review for GitHub</Label>
                    </div>

                    <h1 className="display mt-6 lines !max-w-none">
                        <span className="line">
                            <span
                                data-line
                                style={{ "--i": 0 } as React.CSSProperties}
                            >
                                AI code review that
                            </span>
                        </span>
                        <span className="line">
                            <span
                                data-line
                                style={{ "--i": 1 } as React.CSSProperties}
                            >
                                knows your whole repo.
                            </span>
                        </span>
                    </h1>

                    <p
                        className="lead mt-8 max-w-[58ch]"
                        data-rise
                        style={{ "--i": 1 } as React.CSSProperties}
                    >
                        Prowler is a GitHub App. It indexes your repositories,
                        then reviews every pull request with that context and
                        posts its comments right on the PR.
                    </p>

                    <div
                        className="mt-9 flex flex-wrap items-center gap-4"
                        data-rise
                        style={{ "--i": 2 } as React.CSSProperties}
                    >
                        {primaryCta}
                        <Button
                            render={<a href="#example-review" />}
                            nativeButton={false}
                            size="lg"
                            variant="outline"
                            className="rounded-none"
                        >
                            See an example review
                        </Button>
                    </div>

                    <p
                        className="label mt-7"
                        data-rise
                        style={{ "--i": 3 } as React.CSSProperties}
                    >
                        You choose which repositories it can read.
                    </p>
                </div>

                {/* Never gated on the observer: the hero must paint readable. */}
                <div
                    id="example-review"
                    className="scroll-mt-20 pb-14"
                    data-rise
                    style={{ "--i": 4 } as React.CSSProperties}
                >
                    <ReviewMock />
                </div>
            </div>
        </section>
    );
}