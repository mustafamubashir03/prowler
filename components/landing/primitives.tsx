export function Label({ children }: { children: React.ReactNode }) {
    return <p className="label">{children}</p>;
}

/** The signature mark: corner ticks on a frame. */
export function StatusDot() {
    return (
        <span
            aria-hidden
            className="inline-block size-1.5 shrink-0 bg-primary align-middle"
        />
    );
}

export function Mono({ children }: { children: React.ReactNode }) {
    return (
        <span className="font-mono tnum" style={{ fontSize: "var(--step-small)" }}>
            {children}
        </span>
    );
}