import { Label } from "./primitives";

const STEPS = [
    {
        n: "01",
        label: "Install",
        title: "Add the app",
        body: "Add the Prowler GitHub App to your account or organization.",
    },
    {
        n: "02",
        label: "Choose",
        title: "Pick what it can read",
        body: "Pick the repositories it can read. Prowler indexes them.",
    },
    {
        n: "03",
        label: "Review",
        title: "Comments appear on the pull request",
        body: "Open a pull request. Prowler's comments appear on it in GitHub.",
    },
];

export function HowItWorks() {
    return (
        <section
            id="how-it-works"
            className="scroll-mt-20 border-b border-border py-24 lg:py-36"
        >
            <div className="shell grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
                <div className="lg:sticky lg:top-28 lg:self-start">
                    <Label>How it works</Label>
                    <h2 className="section-head mt-6">Three steps.</h2>
                </div>

                <ol className="flex flex-col">
                    {STEPS.map((step, i) => (
                        <li
                            key={step.n}
                            data-reveal
                            style={{ "--i": i } as React.CSSProperties}
                            className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-border py-8 last:border-b"
                        >
                            <span className="font-mono text-[13px] tnum text-muted-foreground">
                                {step.n}
                            </span>
                            <div>
                                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                                    <h3 className="font-heading text-xl font-medium tracking-tight">
                                        {step.title}
                                    </h3>
                                    <span className="font-mono text-[13px] tracking-[0.1em] text-muted-foreground uppercase">
                                        {step.label}
                                    </span>
                                </div>
                                <p className="body mt-2 max-w-[56ch]">
                                    {step.body}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}