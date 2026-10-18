"use client";

import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";

/**
 * Monaco must come from the bundled package.
 *
 * Left to itself, @monaco-editor/react injects a <script> pointing at jsDelivr,
 * so the editor is fetched from a CDN at runtime. That is a third-party runtime
 * dependency on every page view, it is slow on a cold cache, and it renders
 * nothing when the CDN is blocked or offline. Passing the bundled monaco to
 * loader.config keeps the whole editor in our own chunks.
 *
 * Only the base editor worker is wired up. This viewer is read-only, so the
 * TypeScript, JSON, CSS and HTML language services would only supply completion
 * and diagnostics that nobody can act on, at the cost of four more worker
 * bundles. Syntax highlighting does not need them: it runs on the main thread.
 */
declare global {
    interface Window {
        MonacoEnvironment?: monaco.Environment;
    }
}

window.MonacoEnvironment = {
    getWorker() {
        return new Worker(
            // monaco-editor maps "./*" onto "./esm/vs/*.js", so the worker is
            // reached as monaco-editor/editor/editor.worker.js, not with the
            // full esm/vs path.
            new URL(
                "monaco-editor/editor/editor.worker.js",
                import.meta.url,
            ),
        );
    },
};

loader.config({ monaco });

export { monaco };