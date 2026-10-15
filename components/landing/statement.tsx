/** One sentence, left-anchored, with room around it. Set as a statement at
    the heading step rather than display size, so it stays a sentence. */
export function Statement() {
    return (
        <section className="border-b border-border">
            <div className="shell py-24 lg:py-36">
                <p
                    className="section-head !max-w-[30ch]"
                    data-reveal
                    style={{ "--i": 0 } as React.CSSProperties}
                >
                    A diff shows what changed. Your repository shows what it
                    affects.
                </p>
            </div>
        </section>
    );
}