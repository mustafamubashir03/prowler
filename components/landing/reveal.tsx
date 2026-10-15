"use client";

import { useEffect } from "react";

/**
 * Reveals sections once as they enter the viewport. The hidden state lives in
 * CSS behind `html.js`, so if this never runs the page is simply finished and
 * visible. Nothing is replayed, and no scroll listener is used.
 */
export function RevealOnScroll() {
    useEffect(() => {
        const targets = document.querySelectorAll("[data-reveal]");

        if (!("IntersectionObserver" in window)) {
            targets.forEach((el) => el.classList.add("is-in"));
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-in");
                        observer.unobserve(entry.target);
                    }
                }
            },
            { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
        );

        targets.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, []);

    return null;
}