import Link from "next/link";
import type { ReactNode } from "react";
import { Frame, Section } from "@/components/layout/Frame";
import { JsonLd } from "@/components/seo/JsonLd";
import { Button } from "@/components/ui/button";
import type { ContentPage } from "@/lib/content";
import { article, breadcrumbs, webPage } from "@/lib/structured-data";

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Layout for reading pages: visible breadcrumb, eyebrow, h1, lede, dates, optional table of contents,
 * the body, related reading and a call to action. Emits Article + BreadcrumbList JSON-LD.
 */
export function ArticleShell({
  page,
  crumbs,
  lede,
  toc,
  related,
  cta,
  children,
  schema = "Article",
  extraJsonLd = [],
}: {
  page: ContentPage;
  /** Breadcrumb trail before this page, e.g. [{ name: "Learn", path: "/learn" }]. */
  crumbs: { name: string; path: string }[];
  lede: ReactNode;
  toc?: [id: string, label: string][];
  related?: { href: string; label: string; sub: string }[];
  cta?: { href: string; label: string; secondary?: { href: string; label: string } };
  children: ReactNode;
  schema?: "Article" | "TechArticle" | "WebPage";
  extraJsonLd?: Record<string, unknown>[];
}) {
  const trail = [
    { name: "Moneta", path: "/" },
    ...crumbs,
    { name: page.h1.replace(/\.$/, ""), path: page.path },
  ];
  return (
    <Frame variant="narrative">
      <JsonLd
        data={[
          ...(schema === "WebPage"
            ? [webPage({ name: page.title, description: page.description, path: page.path })]
            : [
                article({
                  type: schema,
                  headline: page.title,
                  description: page.description,
                  path: page.path,
                  published: page.published,
                  modified: page.updated,
                }),
              ]),
          breadcrumbs(trail),
          ...extraJsonLd,
        ]}
      />
      <header className="flex flex-col gap-5 pt-12 pb-10">
        <nav aria-label="Breadcrumb">
          <ol className="mono-xs flex flex-wrap items-center gap-2 text-fg-3">
            {trail.slice(0, -1).map((c) => (
              <li key={c.path} className="flex items-center gap-2">
                <Link href={c.path} className="hover:text-fg">
                  {c.name}
                </Link>
                <span aria-hidden>/</span>
              </li>
            ))}
            <li aria-current="page" className="text-fg-2">
              {trail.at(-1)!.name}
            </li>
          </ol>
        </nav>
        <p className="label-mono text-fg-3">{page.eyebrow}</p>
        <h1 className="heading-xl max-w-[22ch]">{page.h1}</h1>
        <div className="body-lg max-w-[60ch] text-fg-2">{lede}</div>
        <p className="mono-xs text-fg-3">
          Updated <time dateTime={page.updated}>{fmtDate(page.updated)}</time>
          {page.readMinutes ? ` · ${page.readMinutes} min read` : ""}
        </p>
      </header>
      <Section dense className="pb-24">
        <div className="grid gap-10 lg:grid-cols-4">
          {toc ? (
            <nav aria-label="On this page" className="lg:sticky lg:top-20 lg:self-start">
              <p className="mono-xs mb-3 text-fg-3 uppercase">On this page</p>
              <ol className="flex flex-wrap gap-x-4 gap-y-2 lg:flex-col">
                {toc.map(([id, label], i) => (
                  <li key={id}>
                    <a href={`#${id}`} className="body-sm text-fg-2 hover:text-fg">
                      <span className="mono-xs mr-2 text-fg-3">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : (
            <div className="hidden lg:block" />
          )}
          <article className="lg:col-span-3">
            {children}
            {cta && (
              <div className="mt-14 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href={cta.href}>{cta.label}</Link>
                </Button>
                {cta.secondary && (
                  <Button asChild variant="secondary">
                    <Link href={cta.secondary.href}>{cta.secondary.label}</Link>
                  </Button>
                )}
              </div>
            )}
            {related && related.length > 0 && (
              <section aria-labelledby="related" className="mt-16 border-t border-line pt-8">
                <h2 id="related" className="label-mono text-fg-3">
                  Keep reading
                </h2>
                <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                  {related.map((r) => (
                    <li key={r.href}>
                      <Link
                        href={r.href}
                        className="flex h-full flex-col gap-2 rounded-[16px] border border-line-subtle bg-surface-1 p-5 hover:border-line-strong"
                      >
                        <span className="heading-sm">{r.label}</span>
                        <span className="body-sm text-fg-2">{r.sub}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        </div>
      </Section>
    </Frame>
  );
}
