import { auth } from "@/lib/auth";
import { db } from "@/src/prisma/db";
import { headers } from "next/headers";

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

const CALENDAR_QUERY = `query ($from: DateTime!, $to: DateTime!) {
  viewer {
    login
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks {
          firstDay
          contributionDays {
            date
            contributionCount
            color
          }
        }
      }
    }
  }
}`;

type Day = { date: string; contributionCount: number; color: string };

/**
 * Better Auth stores the GitHub OAuth token on the account row. It expires, so
 * a 401 is retried once with a fresh token before giving up. Everything returned
 * here comes straight from GitHub: no values are derived or estimated.
 */
async function githubToken(userId: string): Promise<string | null> {
    const account = await db.orm.auth.AuthAccount.where({
        userId,
        providerId: "github",
    }).first();

    if (!account) return null;

    const expired =
        account.accessTokenExpiresAt != null &&
        new Date(account.accessTokenExpiresAt).getTime() <= Date.now();

    if (!expired && account.accessToken) return account.accessToken;

    if (!account.refreshToken) return account.accessToken ?? null;

    const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            client_id: process.env.GITHUB_APP_CLIENT_ID,
            client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
            grant_type: "refresh_token",
            refresh_token: account.refreshToken,
        }),
    });

    const payload = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
    };

    if (!payload.access_token) return null;

    await db.orm.auth.AuthAccount.where({ id: account.id }).update({
        accessToken: payload.access_token,
        ...(payload.expires_in
            ? {
                  accessTokenExpiresAt: new Date(
                      Date.now() + payload.expires_in * 1000,
                  ).toISOString(),
              }
            : {}),
    });

    return payload.access_token;
}

async function fetchCalendar(token: string, from: Date, to: Date) {
    const response = await fetch(GITHUB_GRAPHQL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "prowler",
        },
        body: JSON.stringify({
            query: CALENDAR_QUERY,
            variables: { from: from.toISOString(), to: to.toISOString() },
        }),
    });

    const payload = (await response.json()) as {
        data?: {
            viewer: {
                login: string;
                contributionsCollection: {
                    contributionCalendar: {
                        totalContributions: number;
                        weeks: { firstDay: string; contributionDays: Day[] }[];
                    };
                };
            };
        };
        errors?: { message: string }[];
    };

    if (payload.errors?.length) {
        throw new Error(payload.errors[0].message);
    }

    const calendar = payload.data!.viewer.contributionsCollection
        .contributionCalendar;

    return {
        login: payload.data!.viewer.login,
        total: calendar.totalContributions,
        days: calendar.weeks.flatMap((week) => week.contributionDays),
    };
}

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = await githubToken(session.user.id);
    if (!token) {
        return Response.json(
            { error: "No GitHub account is connected" },
            { status: 409 },
        );
    }

    const yearParam = new URL(request.url).searchParams.get("year");
    const now = new Date();

    let from: Date;
    let to: Date;
    let year: number | null = null;

    if (yearParam && /^\d{4}$/.test(yearParam)) {
        year = Number(yearParam);
        from = new Date(Date.UTC(year, 0, 1));
        to = new Date(Date.UTC(year + 1, 0, 1));
    } else {
        // GitHub rejects a window wider than one year.
        from = new Date(now.getTime() - 364 * 86_400_000);
        to = now;
    }

    try {
        let calendar;
        try {
            calendar = await fetchCalendar(token, from, to);
        } catch (error) {
            const fresh = await githubToken(session.user.id);
            if (!fresh || fresh === token) throw error;
            calendar = await fetchCalendar(fresh, from, to);
        }

        const activeDays = calendar.days.filter(
            (day) => day.contributionCount > 0,
        ).length;

        let longest = 0;
        let run = 0;
        let previous: string | null = null;
        for (const day of calendar.days) {
            if (day.contributionCount > 0) {
                run =
                    previous &&
                    new Date(day.date).getTime() -
                        new Date(previous).getTime() ===
                        86_400_000
                        ? run + 1
                        : 1;
                longest = Math.max(longest, run);
            } else {
                run = 0;
            }
            previous = day.date;
        }

        return Response.json({
            source: "github",
            login: calendar.login,
            year,
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
            total: calendar.total,
            activeDays,
            longestStreak: longest,
            days: calendar.days,
        });
    } catch (error) {
        return Response.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Could not read GitHub contributions",
            },
            { status: 502 },
        );
    }
}