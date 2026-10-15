import { Label } from "./primitives";

const FEATURES = [
    {
        title: "Whole-repository context",
        body: "Comments are written against the rest of your codebase, not just the changed lines.",
    },
    {
        title: "Comments on the pull request",
        body: "Feedback appears in GitHub, where your team already reviews.",
    },
    {
        title: "Ask your repository",
        body: "Chat about your codebase and get answers that cite the files they came from.",
    },
    {
        title: "Review dashboard",
        body: "See connected repositories, indexing status and the status of every review.",
    },
];

export function Features() {
    return (
        <section
            id="features"
            className="scroll-mt-20 border-b border-border py-24 lg:py-36"
        >
            <div className="shell">
                <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
                    <div data-reveal style={{ "--i": 0 } as React.CSSProperties}>
                        <Label>Features</Label>
                        <h2 className="section-head mt-6">
                            What you get once it is installed.
                        </h2>
                    </div>

                    <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
                        {FEATURES.map((feature, i) => (
                            <div
                                key={feature.title}
                                data-reveal
                                style={{ "--i": i + 1 } as React.CSSProperties}
                                className="bg-background p-6 lg:p-7"
                            >
                                <h3 className="font-heading text-lg font-medium tracking-tight">
                                    {feature.title}
                                </h3>
                                <p className="body mt-2">{feature.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}