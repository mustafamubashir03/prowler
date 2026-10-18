"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

type Turn = { role: "user" | "assistant"; content: string };

type SessionSummary = {
    id: string;
    title: string;
    updatedAt: string;
};

async function fetchSessions(id: string): Promise<SessionSummary[]> {
    const response = await fetch(`/api/chat/sessions?githubRepositoryId=${id}`);

    if (!response.ok) throw new Error("Could not load chat history");

    return response.json() as Promise<SessionSummary[]>;
}

/**
 * `path/to/file.ts:42` or `path/to/file.ts:42-58` becomes a link into the code
 * viewer with the range highlighted. Anything that is not a real citation is
 * left as plain text, so a stray colon in prose does not become a broken link.
 */
function renderWithCitations(text: string, id: string) {
    const pattern = /((?:[\w.-]+\/)*[\w.-]+\.[A-Za-z0-9]+):(\d+)(?:-(\d+))?/g;

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > cursor) {
            nodes.push(text.slice(cursor, match.index));
        }

        const [, path, start, end] = match;
        const params = new URLSearchParams({
            path,
            line: end ? `${start}-${end}` : start,
        });

        nodes.push(
            <Link
                key={`${path}:${start}-${end ?? ""}`}
                href={`/dashboard/repos/${id}/code?${params}`}
                className="font-mono text-[0.9em] underline underline-offset-2 hover:text-foreground"
            >
                {path}:{start}
                {end ? `-${end}` : ""}
            </Link>,
        );

        cursor = match.index + match[0].length;
    }

    if (cursor < text.length) nodes.push(text.slice(cursor));

    return nodes;
}

export function RepoChat({ id }: { id: string }) {
    const [turns, setTurns] = useState<Turn[]>([]);
    const [input, setInput] = useState("");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [streaming, setStreaming] = useState(false);
    const [toolActivity, setToolActivity] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const bottom = useRef<HTMLDivElement>(null);

    const { data: sessions } = useQuery({
        queryKey: ["chat-sessions", id],
        queryFn: () => fetchSessions(id),
        staleTime: 10_000,
    });

    useEffect(() => {
        bottom.current?.scrollIntoView({ behavior: "smooth" });
    }, [turns, toolActivity]);

    const send = useCallback(
        async (question: string) => {
            setError(null);
            setStreaming(true);
            setToolActivity([]);
            setTurns((current) => [
                ...current,
                { role: "user", content: question },
            ]);

            let assistant = "";

            try {
                const response = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        githubRepositoryId: id,
                        message: question,
                        ...(sessionId ? { sessionId } : {}),
                    }),
                });

                if (!response.ok) {
                    const payload = (await response.json().catch(() => null)) as {
                        error?: string;
                    } | null;

                    throw new Error(
                        payload?.error ?? `Request failed (${response.status})`,
                    );
                }

                const reader = response.body?.getReader();

                if (!reader) throw new Error("No response stream");

                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();

                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    const frames = buffer.split("\n\n");
                    buffer = frames.pop() ?? "";

                    for (const frame of frames) {
                        const eventLine = frame
                            .split("\n")
                            .find((line) => line.startsWith("event:"));
                        const dataLine = frame
                            .split("\n")
                            .find((line) => line.startsWith("data:"));

                        if (!eventLine || !dataLine) continue;

                        const event = eventLine.slice(6).trim();
                        const data = JSON.parse(dataLine.slice(5).trim());

                        if (event === "token") {
                            assistant += data.text;
                            setTurns((current) => [
                                ...current.slice(0, -1),
                                { role: "assistant", content: assistant },
                            ]);
                        } else if (event === "tool_call") {
                            setToolActivity((current) => [
                                ...current,
                                `→ ${data.name}(${JSON.stringify(data.input)})`,
                            ]);
                        } else if (event === "tool_result") {
                            setToolActivity((current) => [
                                ...current,
                                `← ${data.name}: ${data.summary}`,
                            ]);
                        } else if (event === "done") {
                            setSessionId(data.sessionId);
                        } else if (event === "error") {
                            throw new Error(data.message);
                        }
                    }
                }
            } catch (caught) {
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "The assistant could not answer.",
                );
            } finally {
                setStreaming(false);
            }
        },
        [id, sessionId],
    );

    return (
        <div className="flex h-full min-h-0">
            <aside className="hidden w-56 shrink-0 border-r border-border lg:block">
                <div className="border-b border-border p-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        History
                    </p>
                </div>
                <ul className="p-2">
                    {(sessions ?? []).map((session) => (
                        <li key={session.id}>
                            <button
                                type="button"
                                onClick={() => {
                                    setSessionId(session.id);
                                    setTurns([]);
                                }}
                                className="w-full truncate px-2 py-1.5 text-left font-mono text-xs text-muted-foreground hover:bg-accent-ink/6"
                            >
                                {session.title}
                            </button>
                        </li>
                    ))}
                    {(sessions ?? []).length === 0 && (
                        <li className="px-2 py-1.5 text-xs text-muted-foreground">
                            No chats yet.
                        </li>
                    )}
                </ul>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex-1 overflow-y-auto p-5">
                    {turns.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            Ask about this repository. Answers cite files and
                            lines, and citations open in the code viewer.
                        </p>
                    )}

                    {turns.map((turn, index) => (
                        <div key={index} className="mb-5">
                            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                                {turn.role}
                            </p>
                            <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                                {renderWithCitations(turn.content, id)}
                            </div>
                        </div>
                    ))}

                    {toolActivity.length > 0 && (
                        <details className="mb-5">
                            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                                Tool activity
                            </summary>
                            <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
                                {toolActivity.join("\n")}
                            </pre>
                        </details>
                    )}

                    {streaming && (
                        <p className="text-sm text-muted-foreground">Thinking...</p>
                    )}

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <div ref={bottom} />
                </div>

                <div className="border-t border-border p-4">
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            const question = input.trim();

                            if (!question || streaming) return;

                            setInput("");
                            void send(question);
                        }}
                        className="flex gap-2"
                    >
                        <input
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            placeholder="Ask about this repository"
                            disabled={streaming}
                            className="h-9 flex-1 border border-input bg-background px-3 text-sm outline-none focus-visible:border-primary disabled:opacity-60"
                            aria-label="Ask about this repository"
                        />
                        <button
                            type="submit"
                            disabled={streaming || !input.trim()}
                            className="h-9 border border-border px-4 font-mono text-xs uppercase tracking-[0.12em] disabled:opacity-60"
                        >
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}