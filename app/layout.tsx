import type { Metadata } from "next";
import { Geist_Mono, Manrope, Noto_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

const manropeHeading = Manrope({
  variable: "--font-heading",
  subsets: ["latin"],
});

const notoSans = Noto_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "Prowler";
const DESCRIPTION =
  "Prowler is an AI pull request reviewer for GitHub. It reviews every pull request with the context of your whole repository and posts the feedback on the pull request.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: `${TITLE} — AI pull request reviewer for GitHub`,
    template: `%s — ${TITLE}`,
  },
  description: DESCRIPTION,
  applicationName: TITLE,
  openGraph: {
    type: "website",
    siteName: TITLE,
    title: `${TITLE} — AI pull request reviewer for GitHub`,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — AI pull request reviewer for GitHub`,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        notoSans.variable,
        manropeHeading.variable,
        geistMono.variable,
        "font-sans",
      )}
    >
      <head>
        {/* Motion is gated on this class so a blocked script leaves the page
            fully visible instead of blank. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('js')`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          storageKey="prowler-theme"
          disableTransitionOnChange
        >
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}