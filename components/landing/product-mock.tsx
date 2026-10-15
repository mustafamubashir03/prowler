const COMMENTS = [
    {
        path: "src/billing/invoice.ts",
        line: "88",
        tag: "CORRECTNESS",
        title: "Rounding disagrees with the ledger",
        body: "invoiceTotal rounds per line item, but the ledger rounds once at the end. Multi-discount invoices can drift by a cent. Round the sum, not each line.",
        outsideDiff: false,
    },
    {
        path: "src/billing/currency.ts",
        line: "41",
        tag: "CONSISTENCY",
        title: "There is already a currency helper here",
        body: "The repository already resolves currency in one place. This change adds a second path that can disagree with it.",
        outsideDiff: true,
    },
    {
        path: "tests/billing/invoice.test.ts",
        line: "42",
        tag: "COVERAGE",
        title: "No case covers a zero-discount invoice",
        body: "Existing fixtures all set a discount, so the rounding path above is never exercised.",
        outsideDiff: false,
    },
];

/**
 * One panel, built in code from the real review shape. Everything in it is
 * placeholder data and is labelled as a sample. The `NOT IN THIS DIFF` tag on
 * the second comment is the visible proof that the review saw more than the
 * changed lines.
 */
export function ReviewMock() {
    return (
        <div
            data-ui
            className="corner-ticks border border-border bg-card text-card-foreground"
        >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <span className="font-mono text-[13px] tracking-[0.08em] uppercase text-muted-foreground">
                    acme/api #1421
                </span>
                <span className="flex items-center gap-2">
                    <span className="border border-border px-1.5 py-0.5 font-mono text-[13px] tracking-[0.1em] text-muted-foreground uppercase">
                        Sample review
                    </span>
                    <span className="border border-accent-ink/45 px-1.5 py-0.5 font-mono text-[13px] tracking-[0.08em] text-accent-ink uppercase">
                        Indexed
                    </span>
                </span>
            </div>

            <ul>
                {COMMENTS.map((comment) => (
                    <li
                        key={`${comment.path}:${comment.line}`}
                        className="border-b border-border px-4 py-4 last:border-b-0"
                    >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-mono text-[13px] text-muted-foreground">
                                {comment.path}:{comment.line}
                            </span>
                            <span className="border border-border px-1.5 py-0.5 font-mono text-[13px] tracking-[0.1em] text-muted-foreground uppercase">
                                {comment.tag}
                            </span>
                            {comment.outsideDiff && (
                                <span className="border-l-2 border-accent-ink/60 pl-2 font-mono text-[13px] tracking-[0.06em] text-accent-ink uppercase">
                                    Not in this diff
                                </span>
                            )}
                        </div>
                        <p className="mt-2 text-[15px] font-medium">{comment.title}</p>
                        <p className="mt-1 max-w-[70ch] text-[15px] leading-relaxed text-muted-foreground">
                            {comment.body}
                        </p>
                    </li>
                ))}
            </ul>
        </div>
    );
}