import type { ReactNode } from "react";

/** Page title block. Server-safe (no client hooks), so marketing pages can use it without the app bundle. */
export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 pt-12 pb-10 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-3">
        {eyebrow}
        <h1 className="heading-xl">{title}</h1>
        {sub && <div className="body max-w-[60ch] text-fg-2">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}
