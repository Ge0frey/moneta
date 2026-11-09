import { Frame, Section } from "@/components/layout/Frame";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Ledger } from "@/components/landing/Live";
import { Origin } from "@/components/landing/Origin";
import { BuiltWith, ClosingCard, Roadmap } from "@/components/landing/Static";
import { Verdict } from "@/components/landing/Verdict";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata } from "@/lib/seo";
import { CARD_TITLE, HOME_DESCRIPTION, HOME_TITLE } from "@/lib/site";
import { siteGraph } from "@/lib/structured-data";

export const metadata = pageMetadata({
  title: HOME_TITLE,
  absolute: true,
  cardTitle: CARD_TITLE,
  description: HOME_DESCRIPTION,
  path: "/",
});

/** ISR: the Ledger's figures and project cards are server-rendered and refreshed every minute. */
export const revalidate = 60;

/**
 * Landing page — narrative frame (1000px, 4 columns), read as numbered plates:
 * I hero · II how it works · III decision markets · (built on Monad) · IV roadmap · V ledger ·
 * VI origin · build with us.
 */
export default function Landing() {
  return (
    <div className="overflow-x-clip">
      <JsonLd data={siteGraph()} />
      <Frame variant="narrative">
        <Hero />
        <Section mark="cross">
          <HowItWorks />
        </Section>
        <Section mark="cross">
          <Verdict />
        </Section>
        <Section mark="cross">
          <BuiltWith />
        </Section>
        <Section mark="cross">
          <Roadmap />
        </Section>
        <Section mark="cross">
          <Ledger />
        </Section>
        <Section mark="cross">
          <Origin />
        </Section>
        <Section mark="cross">
          <ClosingCard />
        </Section>
      </Frame>
    </div>
  );
}
