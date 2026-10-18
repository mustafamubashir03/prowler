"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";

type Day = { date: string; contributionCount: number; color: string };

type Activity = {
    source: "github";
    login: string;
    year: number | null;
    from: string;
    to: string;
    total: number;
    activeDays: number;
    longestStreak: number;
    days: Day[];
};

async function fetchActivity(year?: number) {
    const response = await fetch(
        `/api/activity${year ? `?year=${year}` : ""}`,
    );

    if (!response.ok) {
        throw new Error("Could not read GitHub contributions");
    }

    return response.json() as Promise<Activity>;
}

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// GitHub returns the light-theme hex for each day. Both of its palettes are
// defined as custom properties so dark mode renders the dark scale, which is
// what github.com itself shows and which avoids near-white cells on a dark
// surface. An unrecognised hex is passed through untouched.
const GITHUB_SCALE: Record<string, string> = {
    "#ebedf0": "var(--heat-0)",
    "#9be9a8": "var(--heat-1)",
    "#40c463": "var(--heat-2)",
    "#30a14e": "var(--heat-3)",
    "#216e39": "var(--heat-4)",
};

const LEGEND = [
    "var(--heat-0)",
    "var(--heat-1)",
    "var(--heat-2)",
    "var(--heat-3)",
    "var(--heat-4)",
];

function cellColor(color: string) {
    return GITHUB_SCALE[color.toLowerCase()] ?? color;
}


export function ActivityHeatmap() {
    const currentYear = new Date().getFullYear();

    // Contributions only change when the user commits, so this is held far
    // longer than the default stale time. Switching tabs or years should not
    // re-hit the GitHub API.
    const cache = {
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
    } as const;

    const trailing = useQuery({
        queryKey: ["activity", "trailing"],
        queryFn: () => fetchActivity(),
        ...cache,
    });

    const [selected, setSelected] = useState<number | null>(null);

    const yearly = useQuery({
        queryKey: ["activity", "year", selected],
        queryFn: () => fetchActivity(selected!),
        enabled: selected !== null,
        placeholderData: (previous) => previous,
        ...cache,
    });

    const data = selected === null ? trailing.data : yearly.data;
    const isLoading = selected === null ? trailing.isLoading : yearly.isLoading;
    const isError = selected === null ? trailing.isError : yearly.isError;

    const years = [
        currentYear,
        currentYear - 1,
        currentYear - 2,
        currentYear - 3,
        currentYear - 4,
    ];

    if (isError) {
        return (
            <div className="border-b border-border px-5 py-6">
                <p className="text-sm text-destructive">
                    Could not read contributions from GitHub.
                </p>
            </div>
        );
    }

    const weeks: Day[][] = [];
    if (data) {
        for (let i = 0; i < data.days.length; i += 7) {
            weeks.push(data.days.slice(i, i + 7));
        }
    }

    const monthLabels: { col: number; label: string }[] = [];
    weeks.forEach((week, col) => {
        if (!week.length) return;
        const month = new Date(`${week[0].date}T00:00:00Z`).getUTCMonth();
        const prev = col === 0 ? -1 : new Date(
            `${weeks[col - 1][0].date}T00:00:00Z`,
        ).getUTCMonth();
        if (month !== prev) {
            monthLabels.push({ col, label: MONTHS[month] });
        }
    });

    const heading =
        selected === null
            ? `${data?.total ?? 0} contributions in the last year`
            : `${data?.total ?? 0} contributions in ${selected}`;

    // While the first fetch is in flight, draw the grid shape rather than a
    // bare line of text, so the block does not jump when the data lands.
    const cells: { key: string; color: string; title?: string }[] = data
        ? weeks.flat().map((day) => ({
              key: day.date,
              color: cellColor(day.color),
              title: `${day.contributionCount} contribution${
                  day.contributionCount === 1 ? "" : "s"
              } on ${day.date}`,
          }))
        : Array.from({ length: 371 }, (_, index) => ({
              key: `pending-${index}`,
              color: "var(--muted)",
          }));

    return (
        <section className="border-b border-border">
            <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                        {isLoading && !data ? (
                            <span
                                aria-hidden
                                className="inline-block h-4 w-52 animate-pulse bg-muted motion-reduce:animate-none"
                            />
                        ) : (
                            heading
                        )}
                    </p>

                    <div className="mt-4 flex gap-3">
                        <div className="grid shrink-0 grid-rows-7 gap-[3px] pt-[18px] pr-1 text-[10px] leading-[10px] text-muted-foreground">
                            {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => (
                                <span key={i}>{d}</span>
                            ))}
                        </div>

                        <div className="min-w-0 overflow-x-auto">
                            <div className="relative h-[14px] text-[10px] leading-[14px] text-muted-foreground">
                                {monthLabels.map((label) => (
                                    <span
                                        key={`${label.col}-${label.label}`}
                                        className="absolute whitespace-nowrap"
                                        style={{
                                            left: label.col * 13,
                                        }}
                                    >
                                        {label.label}
                                    </span>
                                ))}
                            </div>

                            <div
                                className="grid gap-[3px]"
                                style={{
                                    gridTemplateRows: "repeat(7, 10px)",
                                    gridAutoFlow: "column",
                                    gridAutoColumns: "10px",
                                }}
                            >
{cells.map((cell) => (
                                <div
                                    key={cell.key}
                                    title={cell.title}
                                    className={`size-[10px] rounded-[2px] ${
                                        cell.title
                                            ? "transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            : "animate-pulse motion-reduce:animate-none"
                                    }`}
                                    style={{ backgroundColor: cell.color }}
                                />
                            ))}
                            </div>

                            <div className="mt-3 flex flex-col gap-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                                <a
                                    href="https://docs.github.com/en/get-started/explaining-projects-to-others/why-github-is-the-best-for-open-source/learning-how-we-count-contributions"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline underline-offset-2 hover:text-foreground"
                                >
                                    Learn how we count contributions
                                </a>

                                <span className="flex shrink-0 items-center gap-1.5">
                                    Less
                                    {LEGEND.map((color) => (
                                        <span
                                            key={color}
                                            className="size-[10px] rounded-[2px]"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    More
                                </span>
                            </div>
                        </div>
                    </div>

                    {data && (
                        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                            {data.login} · {data.activeDays} active days ·{" "}
                            {data.longestStreak} longest streak · synced from
                            GitHub
                        </p>
                    )}
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                    {years.map((year) => {
                        const active = selected === null
                            ? year === currentYear
                            : selected === year;

                        return (
                            <button
                                key={year}
                                type="button"
                                onClick={() =>
                                    setSelected(
                                        selected === year ? null : year,
                                    )
                                }
                                className={`h-8 w-16 rounded-none border text-xs transition-colors ${
                                    active
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border text-muted-foreground hover:border-control hover:text-foreground"
                                }`}
                            >
                                {year}
                            </button>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

