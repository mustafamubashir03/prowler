import { assertUserCanAccessRepository } from "@/lib/github/tenancy";
import { requireAuth } from "@/features/auth/session";
import { toolContextForRepository } from "@/lib/chat/repo-tools";
import { db } from "@/src/prisma/db";

/**
 * Per-user daily limits. Chat is the only endpoint that bills a model on every
 * request, so it is bounded before the first token is spent.
 */
const DAILY_MESSAGE_LIMIT = 60;
const DAILY_TOKEN_LIMIT = 200_000;
const MAX_HISTORY_MESSAGES = 20;

function startOfToday() {
    const now = new Date();
    return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ).toISOString();
}

export const instant = false;

export async function POST(request: Request) {
    const session = await requireAuth();

    const body = (await request.json().catch(() => null)) as {
        githubRepositoryId?: string;
        message?: string;
        sessionId?: string;
    } | null;

    const githubRepositoryId = body?.githubRepositoryId;
    const question = body?.message?.trim();

    if (!githubRepositoryId || !question) {
        return Response.json(
            { error: "githubRepositoryId and message are required" },
            { status: 400 },
        );
    }

    const repository = await assertUserCanAccessRepository(
        session.user.id,
        githubRepositoryId,
    );

    if (!repository) {
        return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Daily limits are counted per user, across every repository.
    const since = startOfToday();

    const todaysMessages = await db.orm.public.ChatMessage.where(
        (fields) => fields.createdAt.gte(since),
    )
        .include("session", (sessions) =>
            sessions.where((fields) => fields.userId.eq(session.user.id)),
        )
        .all();

    if (todaysMessages.length >= DAILY_MESSAGE_LIMIT) {
        return Response.json(
            {
                error: `Daily limit reached (${DAILY_MESSAGE_LIMIT} messages). Try again tomorrow.`,
            },
            { status: 429 },
        );
    }

    const tokensToday = todaysMessages.reduce(
        (total, message) => total + (message.tokens ?? 0),
        0,
    );

    if (tokensToday >= DAILY_TOKEN_LIMIT) {
        return Response.json(
            {
                error: `Daily token limit reached (${DAILY_TOKEN_LIMIT.toLocaleString()}). Try again tomorrow.`,
            },
            { status: 429 },
        );
    }

    // Reuse the session when given, but only if this user owns it.
    let chatSession =
        body?.sessionId
            ? await db.orm.public.ChatSession.where({
                  id: body.sessionId,
              })
                  .where((fields) => fields.userId.eq(session.user.id))
                  .first()
            : null;

    if (!chatSession) {
        chatSession = await db.orm.public.ChatSession.create({
            githubRepositoryId,
            repositoryId: repository.id,
            userId: session.user.id,
            title: question.slice(0, 60),
        });
    }

    await db.orm.public.ChatMessage.create({
        sessionId: chatSession.id,
        role: "user",
        content: question,
    });

    const history = await db.orm.public.ChatMessage.where({
        sessionId: chatSession.id,
    })
        .orderBy((fields) => fields.createdAt.desc())
        .limit(MAX_HISTORY_MESSAGES)
        .all();

    const toolContext = await toolContextForRepository(repository);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            let closed = false;

            const send = (event: string, data: unknown) => {
                if (closed) return;
                controller.enqueue(
                    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
                );
            };

            try {
                const { runChat } = await import("@/lib/chat/run-chat");
                await runChat({
                    question,
                    sessionId: chatSession.id,
                    history: history
                        .reverse()
                        .filter((message) =>
                            message.role === "user" ||
                            message.role === "assistant",
                        )
                        .map((message) => ({
                            role: message.role as "user" | "assistant",
                            content: message.content,
                        })),
                    toolContext,
                    onToken: (text) => send("token", { text }),
                    onToolCall: (name, input) => send("tool_call", { name, input }),
                    onToolResult: (name, summary) =>
                        send("tool_result", { name, summary }),
                });

                if (!closed) {
                    send("done", { sessionId: chatSession!.id });
                }
            } catch (error) {
                console.error(
                    "[chat] failed",
                    error instanceof Error ? error.name : typeof error,
                );
                send("error", {
                    message:
                        error instanceof Error
                            ? error.message
                            : "The assistant could not answer.",
                });
            } finally {
                closed = true;
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            // Without this a proxy may buffer the whole stream and the client
            // sees nothing until the turn ends.
            "X-Accel-Buffering": "no",
        },
    });
}