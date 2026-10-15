"use client"

import * as React from "react"
import { MonitorCog, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

const noopSubscribe = () => () => {}

/**
 * True only after hydration. `useSyncExternalStore` is used rather than a
 * `useEffect` + `setState` pair: it gives the same server/client split without a
 * cascading render, so the first client render matches the server's markup.
 */
function useMounted() {
    return React.useSyncExternalStore(
        noopSubscribe,
        () => true,
        () => false,
    )
}

/**
 * Light / Dark / System, shared by the landing nav, the sign-in screen and the
 * dashboard header so one storage key drives every route.
 *
 * Both variants render a fixed-size placeholder until mounted, because the
 * resolved theme is unknown on the server and guessing would be a hydration
 * mismatch.
 */
export function ThemeToggle({ className }: { className?: string }) {
    const { setTheme, resolvedTheme } = useTheme()
    const mounted = useMounted()

    const isDark = resolvedTheme === "dark"
    const label = isDark ? "Dark theme. Switch to light" : "Light theme. Switch to dark"

    if (!mounted) {
        return (
            <Button
                variant="outline"
                size="icon-sm"
                nativeButton
                aria-hidden="true"
                tabIndex={-1}
                disabled
                className={`shrink-0 rounded-none ${className ?? ""}`}
            />
        )
    }

    return (
        <Button
            variant="outline"
            size="icon-sm"
            nativeButton
            aria-label={label}
            title={label}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`shrink-0 rounded-none transition-colors duration-150 ${className ?? ""}`}
        >
            {isDark ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
        </Button>
    )
}

const OPTIONS = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: MonitorCog },
] as const

/** Three-option switch. Deliberately neutral: the accent stays for real actions. */
export function ThemeMenu({ className }: { className?: string }) {
    const { setTheme, theme } = useTheme()
    const mounted = useMounted()

    if (!mounted) {
        return (
            <div
                aria-hidden="true"
                className={`h-8 w-[6.75rem] shrink-0 border border-border ${className ?? ""}`}
            />
        )
    }

    return (
        <div
            role="group"
            aria-label="Colour theme"
            className={`flex h-8 shrink-0 items-stretch border border-border ${className ?? ""}`}
        >
            {OPTIONS.map((option) => {
                const active = theme === option.value
                const state = active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"

                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        aria-label={`${option.label} theme`}
                        title={`${option.label} theme`}
                        onClick={() => setTheme(option.value)}
                        className={`flex size-8 items-center justify-center transition-colors duration-150 ${state}`}
                    >
                        <option.icon className="size-3.5" aria-hidden />
                    </button>
                )
            })}
        </div>
    )
}