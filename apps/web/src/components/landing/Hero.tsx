import Link from "next/link";
import { AsciiField } from "@/components/art/AsciiField";
import { HeroTile } from "@/components/art/MonetaMark";
import { Button } from "@/components/ui/button";

/** Hero: headline left; temple ASCII field + glass tile right, bleeding into the gutter. */
export function Hero() {
  return (
    <section className="relative grid min-h-[620px] items-center py-24 lg:min-h-[680px] lg:grid-cols-2">
      <div className="relative z-[2] flex flex-col gap-6">
        <h1 className="display-xl max-w-[11ch]">Raise In Public. Spend By Verdict.</h1>
        <p className="body-lg max-w-[42ch] text-fg">
          Moneta is permissionless futarchy capital formation on Monad. Every dollar leaves a
          project&apos;s treasury only when the market says it creates value.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/create">Launch a Raise</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/explore">Explore Raises</Link>
          </Button>
        </div>
      </div>
      <div aria-hidden className="relative h-[360px] lg:h-full">
        <div className="absolute top-1/2 left-1/2 h-[440px] w-[min(820px,120vw)] -translate-x-1/2 -translate-y-1/2 lg:left-[-10%] lg:w-[calc(50vw+260px)] lg:translate-x-0 [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_78%)]">
          <AsciiField
            motif="temple"
            className="size-full"
            cell={10}
            zoom={0.35}
            speed={0.07}
            density={0.024}
            tilt={-0.36}
          />
        </div>
        <div className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
          <HeroTile className="opacity-95" />
        </div>
      </div>
    </section>
  );
}
