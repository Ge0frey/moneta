import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Prose building blocks for reading pages (learn, guides, reference). Server components, monochrome. */

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="heading-md scroll-mt-24 pt-14 first:pt-0">
      <a href={`#${id}`} className="hover:text-fg-2">
        {children}
      </a>
    </h2>
  );
}

export function H3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="heading-sm scroll-mt-24 pt-8 text-fg">
      {children}
    </h3>
  );
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("body mt-4 max-w-[68ch] text-fg-2", className)}>{children}</p>;
}

/** Emphasis inside prose. */
export function Em({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-fg">{children}</strong>;
}

export function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="body mt-4 flex max-w-[68ch] list-disc flex-col gap-2 pl-5 text-fg-2 marker:text-fg-3">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

export function OL({ items }: { items: ReactNode[] }) {
  return (
    <ol className="body mt-4 flex max-w-[68ch] list-decimal flex-col gap-2 pl-5 text-fg-2 marker:text-fg-3">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ol>
  );
}

export function Formula({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <figure className="mt-5 rounded-[12px] border border-line bg-surface-1 px-5 py-4">
      <pre className="mono-md overflow-x-auto whitespace-pre text-fg">{children}</pre>
      {caption && <figcaption className="mono-xs mt-2 text-fg-3">{caption}</figcaption>}
    </figure>
  );
}

export function Table({
  head,
  rows,
  caption,
}: {
  head: string[];
  rows: ReactNode[][];
  caption?: string;
}) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[560px]">
        {caption && <caption className="mono-xs pb-2 text-left text-fg-3">{caption}</caption>}
        <thead>
          <tr className="mono-xs text-fg-3 uppercase">
            {head.map((h) => (
              <th key={h} scope="col" className="py-2 pr-4 text-left font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line-strong align-top">
              {r.map((c, j) =>
                j === 0 ? (
                  <th
                    key={j}
                    scope="row"
                    className="py-3 pr-4 text-left body-sm font-normal text-fg"
                  >
                    {c}
                  </th>
                ) : (
                  <td key={j} className="py-3 pr-4 body-sm text-fg-2">
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A boxed aside: definitions, key takeaways, warnings. */
export function Note({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside className="mt-6 max-w-[68ch] rounded-[12px] border border-line bg-surface-1 px-5 py-4">
      <p className="label-mono text-fg-3">{label}</p>
      <div className="body mt-2 text-fg">{children}</div>
    </aside>
  );
}

/** An in-prose link with visible underline (internal routes use next/link). */
export function A({ href, children }: { href: string; children: ReactNode }) {
  const cls = "text-fg underline underline-offset-4 decoration-line-strong hover:decoration-fg";
  if (href.startsWith("http"))
    return (
      <a href={href} className={cls} rel="noopener">
        {children}
      </a>
    );
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
