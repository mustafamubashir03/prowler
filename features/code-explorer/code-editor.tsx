"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useCallback, useRef } from "react";
import { type OnMount } from "@monaco-editor/react";

/**
 * Monaco touches `window` at import time, so it is pulled in on the client only.
 * A separate module boundary also keeps the ~2MB editor out of the server bundle.
 */
const Editor = dynamic(() => import("@monaco-editor/react"), {
    ssr: false,
    loading: () => (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading editor...
        </div>
    ),
});

export function CodeEditor({
    value,
    language,
    startLineNumber,
    endLineNumber,
}: {
    value: string;
    language: string;
    startLineNumber: number;
    endLineNumber: number;
}) {
    const { resolvedTheme } = useTheme();
    const decorations = useRef<string[]>([]);
    const hasRange = endLineNumber > startLineNumber;
    const dark = resolvedTheme === "dark";

    const applyHighlight = useCallback(
        (
            editor: Parameters<OnMount>[0],
            monaco: Parameters<OnMount>[1],
        ) => {
            decorations.current = editor.deltaDecorations(decorations.current, []);

            if (!hasRange) return;

            decorations.current = editor.deltaDecorations(
                [],
                [
                    {
                        range: new monaco.Range(
                            startLineNumber,
                            1,
                            startLineNumber,
                            1,
                        ),
                        options: {
                            isWholeLine: true,
                            className: "prowler-line-highlight",
                        },
                    },
                    ...(endLineNumber > startLineNumber
                        ? [
                              {
                                  range: new monaco.Range(
                                      endLineNumber,
                                      1,
                                      endLineNumber,
                                      1,
                                  ),
                                  options: {
                                      isWholeLine: true,
                                      className: "prowler-line-highlight",
                                  },
                              },
                          ]
                        : []),
                ],
            );

            editor.revealLineInCenter(startLineNumber);
        },
        [hasRange, startLineNumber, endLineNumber],
    );

    const handleMount = useCallback<OnMount>(
        (editor, monaco) => applyHighlight(editor, monaco),
        [applyHighlight],
    );

    return (
        <Editor
            height="100%"
            theme={dark ? "vs-dark" : "light"}
            language={language}
            value={value}
            // Read only: this viewer never writes back to the repository.
            options={{
                readOnly: true,
                domReadOnly: true,
                fontSize: 12,
                fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                renderLineHighlight: "gutter",
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
            }}
            onMount={handleMount}
        />
    );
}