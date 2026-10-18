import { auth } from "@/lib/auth";
import { db } from "@/src/prisma/db";
import { headers } from "next/headers";

const DAY = 86_400_000;

/** UTC calendar day, which is how a contribution graph buckets activity. */
function dayKey(value: string | Date) {
    return new Date(value).toISOString().slice(0, 10);
}

export async function GET() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const installations = await db.orm.public.GitHubInstallation.where({
        userId: session.user.id,
    }).all();

    const installationIds = installations.map((installation) => installation.id);

    if (installationIds.length === 0) {
        return Response.json({ counts: {}, total: 0, streak: 0 });
    }

    const repositories = await db.orm.public.GitHubRepository.where((fields) =>
        fields.installationId.in(installationIds),
    ).all();

    const repositoryIds = repositories.map((repository) => repository.id);

    const reviews =
        repositoryIds.length === 0
            ? []
            : await db.orm.public.PullRequestReview.where((fields) =>
                  fields.repositoryId.in(repositoryIds),
              ).all();

    const counts: Record<string, number> = {};

    const bump = (value: string | Date | null) => {
        if (!value) return;
        const key = dayKey(value);
        counts[key] = (counts[key] ?? 0) + 1;
    };

    for (const review of reviews) {
        bump(review.createdAt);
    }

    for (const repository of repositories) {
        bump(repository.indexedAt);
    }

    const sorted = Object.keys(counts).sort();

    let total = 0;
    let longest = 0;
    let run = 0;

    if (sorted.length > 0) {
        const first = new Date(`${sorted[0]}T00:00:00Z`).getTime();
        let previous = first - DAY;

        for (const key of sorted) {
            const current = new Date(`${key}T00:00:00Z`).getTime();
            run = current - previous === DAY ? run + 1 : 1;
            longest = Math.max(longest, run);
            previous = current;
            total += counts[key];
        }
    }

    // Current streak counts back from today, so an old gap does not reset it.
    const today = dayKey(new Date());
    let current = 0;
    for (let i = 0; i < 366; i++) {
        const key = dayKey(new Date(Date.now() - i * DAY));
        if (counts[key]) {
            current = i === 0 || counts[dayKey(new Date(Date.now() - (i - 1) * DAY))] ? current + 1 : 1;
        } else if (i === 0) {
            // Today may simply not have activity yet.
            continue;
        } else {
            break;
        }
    }

    return Response.json({
        counts,
        total,
        longestStreak: longest,
        currentStreak: current,
        activeDays: sorted.length,
    });
}