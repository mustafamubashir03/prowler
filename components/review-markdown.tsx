"use client"

import { Streamdown } from "streamdown"
import { code } from "@streamdown/code"
import "streamdown/styles.css"


export function ReviewMarkdown({ content, isAnimating = false }: { content: string, isAnimating?: boolean }) {
    return (
        <div className="prose dark:prose-invert prose-h1:text-xl prose-h2:text-lg prose-h3:text-lg max-w-none">
            <Streamdown
                mode={isAnimating ? undefined : "static"}
                plugins={{ code }}
                isAnimating={isAnimating}
                className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
                {content}
            </Streamdown>
        </div>
    )
}