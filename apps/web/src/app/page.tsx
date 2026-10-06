import { Frame, Section } from "@/components/layout/Frame";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Ledger } from "@/components/landing/Live";
import { Origin } from "@/components/landing/Origin";
import { BuiltWith, ClosingCard, Roadmap } from "@/components/landing/Static";
import { Verdict } from "@/components/landing/Verdict";

/**
 * Landing page — narrative frame (1000px, 4 columns), read as numbered plates:
 * I hero · II how it works · III decision markets · (built on Monad) · IV roadmap · V ledger ·
 * VI origin · build with us.
 */
export default function Landing() {
  return (
    <div className="overflow-x-clip">
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
