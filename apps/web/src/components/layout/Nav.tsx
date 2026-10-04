"use client";

import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/art/MonetaMark";
import { LiveDot } from "@/components/ui/pills";
import { cn } from "@/lib/cn";
import { CHAIN } from "@/lib/env";
import { WalletButton } from "./Wallet";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/create", label: "Create" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/docs", label: "Docs" },
];

function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  const path = usePathname();
  const active = path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "body-sm transition-colors duration-150",
        active ? "text-fg" : "text-fg-2 hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
}

function SearchBox() {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        e.key === "/" &&
        t &&
        !["INPUT", "TEXTAREA"].includes(t.tagName) &&
        !t.isContentEditable
      ) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = ref.current?.value.trim();
        router.push(q ? `/explore?q=${encodeURIComponent(q)}` : "/explore");
      }}
      className="relative hidden lg:block"
    >
      <label htmlFor="nav-search" className="sr-only">
        Search raises, tokens and addresses
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-fg-3"
      />
      <input
        ref={ref}
        id="nav-search"
        type="search"
        autoComplete="off"
        placeholder="Raises, tokens, addresses"
        className="h-8 w-[260px] rounded-[8px] border border-line bg-surface-1 pr-9 pl-8 body-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-[4px] border border-line px-1.5 mono-xs text-fg-3">
        /
      </kbd>
    </form>
  );
}

export function NetworkPill() {
  return (
    <span className="hidden h-8 items-center gap-2 rounded-full border border-line px-3 mono-xs text-fg-2 md:inline-flex">
      <LiveDot tone="pass" />
      {CHAIN.name}
    </span>
  );
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 h-14 border-b backdrop-blur-md transition-colors duration-200",
        scrolled ? "border-line-subtle bg-canvas/85" : "border-transparent bg-canvas/60",
      )}
    >
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-8 px-4 sm:px-6">
        <Link href="/" aria-label="Moneta home" className="shrink-0">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.href} {...l} />
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SearchBox />
          <NetworkPill />
          <div className="hidden sm:block">
            <WalletButton />
          </div>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full text-fg md:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" aria-hidden />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/70" />
              <Dialog.Content className="fixed inset-x-0 top-0 z-[71] border-b border-line bg-canvas p-4">
                <div className="flex items-center justify-between">
                  <Dialog.Title asChild>
                    <span>
                      <Wordmark />
                    </span>
                  </Dialog.Title>
                  <Dialog.Close
                    className="grid size-10 place-items-center rounded-full"
                    aria-label="Close menu"
                  >
                    <X className="size-5" aria-hidden />
                  </Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
                <nav aria-label="Mobile" className="mt-4 flex flex-col">
                  {LINKS.map((l) => (
                    <div key={l.href} className="border-b border-line-subtle py-3">
                      <NavLink {...l} onClick={() => setOpen(false)} />
                    </div>
                  ))}
                </nav>
                <div className="mt-4">
                  <WalletButton block />
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
