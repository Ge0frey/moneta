import { Frame, Section } from "@/components/layout/Frame";
import { Hero } from "@/components/landing/Hero";
import { LiveOnMoneta, LiveStats, ValuePill } from "@/components/landing/Live";
import {
  Bento,
  BuiltWith,
  ClosingCard,
  CtaCard,
  DecisionMarketsFeature,
  HowItWorks,
  Roadmap,
  UseMoneta,
} from "@/components/landing/Static";

/** Landing page — narrative frame (1000px, 4 columns). */
export default function Landing() {
  return (
    <div className="overflow-x-clip">
      <Frame variant="narrative">
        <Hero />
        <Section ticks={false} className="pt-0 lg:pt-0">
          <div className="flex flex-col gap-4">
            <DecisionMarketsFeature />
            <Bento />
          </div>
        </Section>
        <Section>
          <HowItWorks />
        </Section>
        <Section>
          <BuiltWith />
        </Section>
        <Section>
          <Roadmap />
        </Section>
        <Section>
          <ValuePill />
        </Section>
        <Section>
          <UseMoneta />
        </Section>
        <Section>
          <CtaCard />
        </Section>
        <Section>
          <LiveStats />
        </Section>
        <Section>
          <LiveOnMoneta />
        </Section>
        <Section>
          <ClosingCard />
        </Section>
      </Frame>
    </div>
  );
}
