"use client";

import { useQuery } from "@tanstack/react-query";

const WEEKS = 53;
const DAY = 86_400_000;

// GitHub's own palette for the contribution graph.
const LEVELS = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

async function fetchActivity() {
    const response = await fetch("/api/activity");
    if (!response.ok) throw new Error("Failed to load activity");
    return response.json() as Promise<{
        counts: Record<string, number>;
        total: number;
        longestStreak: number;
        currentStreak: number;
        activeDays: number;
    }>;
}

function dayKey(date: Date) {
    return date.toISOString().slice(0, 10);
}

function level(count: number) {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 9) return 3;
    return 4;
}

export function ActivityHeatmap() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["activity"],
        queryFn: fetchActivity,
    });

    // Anchor to the Saturday that ends the current week so columns stay aligned.
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    const endOffset = (end.getUTCDay() + 6) % 7;
    end.setTime(end.getTime() + (6 - endOffset) * DAY);

    const days: { key: string; count: number; date: Date }[] = [];

    for (let w = WEEKS - 1; w >= 0; w--) {
        for (let d = 0; d < 7; d++) {
            const date = new Date(end.getTime() - (w * 7 + (6 - d)) * DAY);
            const key = dayKey(date);
            days.push({ key, count: data?.counts?.[key] ?? 0, date });
        }
    }

    const monthLabels: { index: number; label: string }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < WEEKS; w++) {
        const month = days[w * 7].date.getUTCMonth();
        if (month !== lastMonth) {
            lastMonth = month;
            monthLabels.push({ index: w, label: MONTHS[month] });
        }
    }

    if (isError) {
        return (
            <p className="px-5 py-6 text-sm text-destructive">
                Could not load activity.
            </p>
        );
    }

    return (
        <section className="border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Activity
                </p>
                {!isLoading && data && (
                    <div className="flex items-center gap-5 font-mono text-[11px] tabular-nums text-muted-foreground">
                        <span>
                            <span className="text-foreground">{data.total}</span>{" "}
                            events
                        </span>
                        <span>
                            <span className="text-foreground">
                                {data.activeDays}
                            </span>{" "}
                            active days
                        </span>
                        <span>
                            <span className="text-foreground">
                                {data.longestStreak}
                            </span>{" "}
                            longest streak
                        </span>
                    </div>
                )}
            </div>

            <div className="overflow-x-auto px-5 py-4">
                <div className="inline-flex min-w-full flex-col gap-2">
                    <div className="relative h-3" style={{ minWidth: WEEKS * 13 }}>
                        {monthLabels.map((label) => (
                            <span
                                key={`${label.index}-${label.label}`}
                                className="absolute font-mono text-[10px] text-muted-foreground"
                                style={{ left: label.index * 13 }}
                            >
                                {label.label}
                            </span>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <div className="grid grid-rows-7 gap-[3px] pt-[1px] text-[9px] leading-none text-muted-foreground">
                            {["", "Mon", "", "Wed", "", "Fri", ""].map(
                                (day, index) => (
                                    <span
                                        key={index}
                                        className="h-[10px] leading-[10px]"
                                    >
                                        {day}
                                    </span>
                                ),
                            )}
                        </div>

                        <div
                            className="grid gap-[3px]"
                            style={{ gridTemplateColumns: `repeat(${WEEKS}, 10px)` }}
                        >
                            {days.map((day) => (
                                <div
                                    key={day.key}
                                    title={`${day.count} event${day.count === 1 ? "" : "s"} on ${day.date.toUTCString().slice(5, 16)}`}
                                    className="size-[10px] rounded-[2px] transition-transform hover:scale-125 focus-visible:scale-125"
                                    style={{
                                        backgroundColor:
                                            LEVELS[level(day.count)],
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pl-[30px] font-mono text-[10px] text-muted-foreground">
                        <span>Less</span>
                        {LEVELS.map((color, index) => (
                            <span
                                key={color}
                                className="size-[10px] rounded-[2px]"
                                style={{ backgroundColor: color }}
                                title={index === 0 ? "No activity" : `Level ${index}`}
                            />
                        ))}
                        <span>More</span>
                    </div>
                </div>
            </div>
        </section>
    );
}