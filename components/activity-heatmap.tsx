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

// GitHub renders its own scale with these exact values.
const LEGEND = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];


export function ActivityHeatmap() {
    const currentYear = new Date().getFullYear();

    const trailing = useQuery({
        queryKey: ["activity", "trailing"],
        queryFn: () => fetchActivity(),
    });

    const [selected, setSelected] = useState<number | null>(null);

    const yearly = useQuery({
        queryKey: ["activity", "year", selected],
        queryFn: () => fetchActivity(selected!),
        enabled: selected !== null,
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

    return (
        <section className="border-b border-border">
            <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                        {isLoading && !data
                            ? "Loading contributions..."
                            : heading}
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
                                {(weeks.length ? weeks.flat() : []).map((day) => (
                                    <div
                                        key={day.date}
                                        title={`${day.contributionCount} contribution${
                                            day.contributionCount === 1 ? "" : "s"
                                        } on ${day.date}`}
                                        className="size-[10px] rounded-[2px] transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        style={{
                                            backgroundColor: day.color,
                                        }}
                                    />
                                ))}
                            </div>

                            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                                <a
                                    href="https://docs.github.com/en/get-started/explaining-projects-to-others/why-github-is-the-best-for-open-source/learning-how-we-count-contributions"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline underline-offset-2 hover:text-foreground"
                                >
                                    Learn how we count contributions
                                </a>

                                <span className="flex items-center gap-1.5">
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
                        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
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

