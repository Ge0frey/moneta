import type { IndexedRaise } from "@moneta/sdk";
import { keccak256, toBytes } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proposalHref, raiseHref } from "./listing";
import { memoTemplate } from "./raise-form";
import {
  clampText,
  cleanLabel,
  isTemplateMemo,
  memoThesis,
  pageMetadata,
  plainText,
  wordCount,
} from "./seo";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("pageMetadata", () => {
  it("sets canonical, og:url and page-specific cards (no inherited homepage card)", () => {
    const m = pageMetadata({ title: "Docs", description: "How it works.", path: "/docs" });
    expect(m.title).toBe("Docs");
    expect(m.alternates?.canonical).toBe("/docs");
    expect(m.openGraph).toMatchObject({
      url: "/docs",
      title: "Docs · Moneta",
      description: "How it works.",
    });
    expect(m.twitter).toMatchObject({ title: "Docs · Moneta", description: "How it works." });
    expect((m.openGraph as { images: unknown[] }).images).toHaveLength(1);
    expect(m.robots).toBeUndefined();
  });

  it("emits no config image when a route has its own opengraph-image, and noindex,follow on request", () => {
    const m = pageMetadata({
      title: "Raise",
      description: "d",
      path: "/raise/0xab",
      image: null,
      noindex: true,
    });
    expect(m.openGraph).not.toHaveProperty("images");
    expect(m.twitter).not.toHaveProperty("images");
    expect(m.robots).toEqual({ index: false, follow: true });
  });

  it("supports an absolute title with a separate card title (home)", () => {
    const m = pageMetadata({
      title: "Home Title",
      absolute: true,
      cardTitle: "Card",
      description: "d",
      path: "/",
    });
    expect(m.title).toEqual({ absolute: "Home Title" });
    expect(m.openGraph).toMatchObject({ title: "Card" });
  });
});

describe("memo text helpers", () => {
  const memo =
    "# Compass\n\n## Thesis\n\nA [smart wallet](https://x.y) for **everyone**.\n\n## Team\n\nUs.";

  it("extracts the Thesis section as plain text", () => {
    expect(memoThesis(memo)).toBe("A smart wallet for everyone.");
    expect(plainText("| a | b |\n|---|---|\ntext")).toBe("text");
  });

  it("detects the unfilled create-wizard template", () => {
    const template = memoTemplate({ name: "X", tranches: ["10"] } as Parameters<
      typeof memoTemplate
    >[0]);
    expect(isTemplateMemo(template)).toBe(true);
    expect(isTemplateMemo(memo)).toBe(false);
  });

  it("clamps at a word boundary and counts words", () => {
    expect(clampText("one two three four", 10)).toBe("one two…");
    expect(clampText("short", 10)).toBe("short");
    expect(wordCount(memo)).toBe(9);
  });

  it("strips bidi and zero-width characters from user labels", () => {
    expect(cleanLabel("Ev‮il​ Name", 40)).toBe("Evil Name");
  });
});

describe("canonical on-chain URLs", () => {
  it("are always lowercase", () => {
    expect(raiseHref("0xAbC")).toBe("/raise/0xabc");
    expect(proposalHref("0xAbC", 3n)).toBe("/project/0xabc/proposal/3");
  });
});

describe("indexing switches", () => {
  const memo = `# P\n\n## Thesis\n\n${"word ".repeat(160)}`;
  const raise = (over: Partial<IndexedRaise> = {}) =>
    ({
      address: "0x1",
      treasury: null,
      status: "SUCCEEDED",
      aborted: false,
      memo,
      memoHash: keccak256(toBytes(memo)),
      createdAt: "1",
      ...over,
    }) as IndexedRaise;

  it("keeps on-chain pages out of the index unless the flag is on and the gate passes", async () => {
    const off = await import("./seo-onchain");
    expect(off.raiseIndexable(raise())).toBe(false); // flag off (testnet)

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SEO_INDEX_ONCHAIN", "true");
    const on = await import("./seo-onchain");
    expect(on.raiseIndexable(raise())).toBe(true);
    expect(on.raiseIndexable(raise({ status: "FAILED" }))).toBe(false);
    expect(on.raiseIndexable(raise({ memoHash: "0xdead" }))).toBe(false); // edited memo
    expect(
      on.raiseIndexable(
        raise({
          memo: "# P\n\n## Thesis\n\ntoo short",
          memoHash: keccak256(toBytes("# P\n\n## Thesis\n\ntoo short")),
        }),
      ),
    ).toBe(false);
    expect(on.raiseIndexable(raise({ createdAt: String(Math.floor(Date.now() / 1000)) }))).toBe(
      false,
    ); // < 24h old
  });

  it("serves a blocking robots.txt outside Vercel production", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const preview = (await import("../app/robots")).default();
    expect(preview).toEqual({ rules: { userAgent: "*", disallow: "/" } });

    vi.resetModules();
    vi.stubEnv("VERCEL_ENV", "production");
    const prod = (await import("../app/robots")).default();
    expect(prod.sitemap).toBe("https://www.monetafutarchy.xyz/sitemap.xml");
    expect(prod.rules).toEqual([{ userAgent: "*", allow: "/", disallow: ["/explore?q="] }]);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SEO_BLOCK_INDEXING", "true"); // e.g. the testnet host after mainnet
    const blocked = (await import("../app/robots")).default();
    expect(blocked).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});
