import Link from "next/link";
import { AsciiField } from "@/components/art/AsciiField";
import { Frame } from "@/components/layout/Frame";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/pills";

export default function NotFound() {
  return (
    <Frame variant="narrative">
      <section className="flex flex-col items-center gap-6 py-24 text-center">
        <AsciiField
          motif="fork"
          className="h-[200px] w-full max-w-[420px]"
          cell={9}
          zoom={0.3}
          density={0.026}
          tilt={-0.12}
        />
        <Eyebrow>404</Eyebrow>
        <h1 className="heading-xl">Nothing Priced Here.</h1>
        <p className="body max-w-[48ch] text-fg-2">
          This page doesn&apos;t exist on this network. The raise, treasury or proposal may live on
          another chain, or the link is mistyped.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/explore">Explore raises</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </section>
    </Frame>
  );
}
