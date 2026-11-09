import Link from "next/link";
import { Frame, Section } from "@/components/layout/Frame";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageHeader } from "@/components/ui/page-header";
import { Eyebrow } from "@/components/ui/pills";
import { GUIDES, LEARN } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbs, webPage } from "@/lib/structured-data";

const TITLE = "Learn Futarchy and Decision Markets";
const DESCRIPTION =
  "Plain-language guides to futarchy, decision markets, lagging-TWAP verdicts and raising a crypto startup’s first round in public on Monad.";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/learn",
  image: null,
});

const REFERENCE = [
  {
    path: "/docs",
    h1: "How Moneta Works",
    description: "The full rules: raises, launch, treasury, verdicts, redemption and security.",
  },
  ...GUIDES.filter((g) => g.path !== "/about"),
];

export default function LearnHub() {
  return (
    <Frame variant="narrative">
      <JsonLd
        data={[
          webPage({ name: TITLE, description: DESCRIPTION, path: "/learn" }),
          breadcrumbs([
            { name: "Moneta", path: "/" },
            { name: "Learn", path: "/learn" },
          ]),
        ]}
      />
      <PageHeader
        eyebrow={<Eyebrow className="w-fit">Learn</Eyebrow>}
        title="Learn Futarchy."
        sub="How markets can decide where money goes, and how Moneta uses them to fund builders on Monad. Start with the first article if the idea is new to you."
      />
      <Section dense className="pb-28">
        <h2 className="label-mono text-fg-3">Articles</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-2">
          {LEARN.map((a, i) => (
            <li key={a.path}>
              <Link
                href={a.path}
                className="flex h-full flex-col gap-3 rounded-[16px] border border-line-subtle bg-surface-1 p-6 hover:border-line-strong"
              >
                <span className="mono-xs text-fg-3">
                  {String(i + 1).padStart(2, "0")} · {a.eyebrow.replace(/^Learn · /, "")}
                  {a.readMinutes ? ` · ${a.readMinutes} min` : ""}
                </span>
                <span className="heading-md">{a.h1}</span>
                <span className="body-sm text-fg-2">{a.description}</span>
              </Link>
            </li>
          ))}
        </ol>
        <h2 className="label-mono mt-14 text-fg-3">Guides and reference</h2>
        <ul className="mt-5 divide-y divide-line-strong border-y border-line-strong">
          {REFERENCE.map((g) => (
            <li key={g.path}>
              <Link
                href={g.path}
                className="flex flex-col gap-1 py-4 hover:text-fg sm:flex-row sm:gap-6"
              >
                <span className="body text-fg sm:w-[30%] sm:shrink-0">
                  {g.h1.replace(/\.$/, "")}
                </span>
                <span className="body-sm text-fg-2">{g.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </Frame>
  );
}
