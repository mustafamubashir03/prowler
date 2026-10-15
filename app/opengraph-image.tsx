import { ImageResponse } from "next/og";

export const alt = "Prowler";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Mark plus wordmark on the dark ground. No claims, no copy. */
export default function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 48,
                    background: "#0a0a0a",
                    color: "#ffffff",
                }}
            >
                <svg width="200" height="200" viewBox="0 0 32 32">
                    <g
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2.2"
                        strokeLinejoin="miter"
                    >
                        <path d="M4 4 H25 L28 7 V28 H4 Z" />
                    </g>
                    <g
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="4.6"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                    >
                        <path d="M18 11 L11 16 L18 21" />
                        <path d="M14 11 L21 16 L14 21" />
                    </g>
                </svg>

                <div
                    style={{
                        display: "flex",
                        fontSize: 76,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        fontWeight: 400,
                    }}
                >
                    Prowler
                </div>
            </div>
        ),
        size,
    );
}