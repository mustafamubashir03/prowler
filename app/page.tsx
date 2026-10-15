import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Closing, SiteFooter } from "@/components/landing/closing";
import { Features } from "@/components/landing/capabilities";
import { Hero, LandingNav } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { RevealOnScroll } from "@/components/landing/reveal";
import { Statement } from "@/components/landing/statement";
import { Trust } from "@/components/landing/trust";
import { getSession } from "@/features/auth/session";
import { AUTH_ROUTES } from "@/features/lib/routes";

// The hero CTA only depends on whether a session exists, so this stays a server
// component. RevealOnScroll is the only client island.
export const instant = false;

export default async function LandingPage() {
  const session = await getSession();
  const isSignedIn = Boolean(session);
  const href = isSignedIn ? AUTH_ROUTES.dashboard : AUTH_ROUTES.signIn;

  const primaryCta = (
    <Button render={<Link href={href} />} nativeButton={false} size="lg" className="rounded-none">
      {isSignedIn ? "Open dashboard" : "Install on GitHub"}
    </Button>
  );

  return (
    <>
      <LandingNav isSignedIn={isSignedIn} />
      <main>
        <Hero primaryCta={primaryCta} />
        <Statement />
        <HowItWorks />
        <Features />
        <Trust />
        <Closing primaryCta={primaryCta} />
      </main>
      <SiteFooter />
      <RevealOnScroll />
    </>
  );
}