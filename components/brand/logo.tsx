/**
 * Prowler logo. Original geometry only, drawn with currentColor so the mark
 * follows the active theme. No external fonts; the wordmark uses the Geist Mono
 * variable already loaded by the app.
 *
 * The marks are a hard-edged notched frame with two angular slit eyes. Two
 * builds are provided for each concept:
 *   - full: the intended mark at 24px and up.
 *   - optical: a purpose-built 16px version with thicker strokes and wider
 *     eye gaps. A 16px rendering of the full mark closes the slits into a bar,
 *     so the small build is authored separately rather than scaled down.
 */

type Build = "full" | "optical";

const FRAME: Record<Build, number> = { full: 2.2, optical: 3 };
const EYE: Record<Build, number> = { full: 4.6, optical: 6.4 };
const GAP: Record<Build, number> = { full: 1, optical: 2.4 };

/** Notched square frame: one 45-degree cut at the top-right corner. */
function Frame({ build }: { build: Build }) {
    return (
        <path
            d="M4 4 H25 L28 7 V28 H4 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth={FRAME[build]}
            strokeLinejoin="miter"
        />
    );
}

/** A. Bracket eyes — one chevron pointing left, one pointing right.
 *  The chevrons are inset from the frame so they never cross at the centre. */
export function BracketEyes({ build = "full" }: { build?: Build }) {
    const g = GAP[build];
    const w = EYE[build];
    const apexL = 8 - g;
    const armL = 15 - g;
    const apexR = 24 + g;
    const armR = 17 + g;
    return (
        <g
            fill="none"
            stroke="currentColor"
            strokeWidth={w}
            strokeLinecap="square"
            strokeLinejoin="miter"
        >
            <Frame build={build} />
            <path d={`M${armL} 10 L${apexL} 16 L${armL} 22`} />
            <path d={`M${armR} 10 L${apexR} 16 L${armR} 22`} />
        </g>
    );
}

/** B. Diff eyes — a minus bar in one eye, a plus in the other. */
export function DiffEyes({ build = "full" }: { build?: Build }) {
    const g = GAP[build];
    const w = EYE[build];
    return (
        <g
            fill="none"
            stroke="currentColor"
            strokeWidth={w}
            strokeLinecap="square"
            strokeLinejoin="miter"
        >
            <Frame build={build} />
            <path d={`M${7 + g} 16 H${16 - g}`} />
            <path d={`M${16 + g} 16 H${25 - g}`} />
            <path d={`M${21 - g / 2} 11.5 V20.5`} />
        </g>
    );
}

/** C. Watcher — two slanted slits, with the status light set in the frame's
 *  lower-right corner so it never collides with a slit at small sizes. */
export function WatcherEyes({ build = "full" }: { build?: Build }) {
    const g = GAP[build];
    return (
        <g stroke="currentColor" strokeLinecap="square" fill="currentColor">
            <Frame build={build} />
            <path
                d={`M${7 + g} 12 L${15 - g} 10.5 L${15 - g} 14 L${7 + g} 15.5 Z`}
                stroke="none"
            />
            <path
                d={`M${17 + g} 15.5 L${25 - g} 14 L${25 - g} 17.5 L${17 + g} 19 Z`}
                stroke="none"
            />
            <rect x={23.6} y={23} width={2.6} height={2.6} stroke="none" />
        </g>
    );
}

export const MARKS = {
    bracket: BracketEyes,
    diff: DiffEyes,
    watcher: WatcherEyes,
} as const;

export type MarkVariant = keyof typeof MARKS;

/**
 * The chosen mark. Sizes at or below 16 swap to the optical build so the
 * slits stay open at favicon size.
 */
export function Mark({
    variant = "diff",
    size = 24,
    className,
}: {
    variant?: MarkVariant;
    size?: number;
    className?: string;
}) {
    const Component = MARKS[variant];
    const build: Build = size <= 16 ? "optical" : "full";

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            aria-hidden="true"
            focusable="false"
            className={className}
        >
            <Component build={build} />
        </svg>
    );
}

/** Mark plus wordmark. The mark is decorative; the name is the text. */
export function Logo({
    variant = "diff",
    size = 24,
    showWordmark = true,
    className,
}: {
    variant?: MarkVariant;
    size?: number;
    showWordmark?: boolean;
    className?: string;
}) {
    return (
        <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
            <Mark variant={variant} size={size} />
            {showWordmark && (
                <span
                    className="font-mono uppercase leading-none"
                    style={{
                        fontSize: Math.max(11, Math.round(size * 0.34)),
                        letterSpacing: "0.2em",
                    }}
                >
                    Prowler
                </span>
            )}
        </span>
    );
}