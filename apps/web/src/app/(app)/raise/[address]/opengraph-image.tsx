import { big, formatTokenPrice, formatUsd } from "@moneta/sdk";
import { quoteSym } from "@/lib/env";
import { OG_CONTENT_TYPE, OG_SIZE, renderCard } from "@/lib/og";
import { displayName, displaySymbol, utcDate } from "@/lib/seo-onchain";
import { getRaise } from "@/lib/server/data";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A Moneta raise: name, terms and progress";
export const revalidate = 120;

const usd = (v: string) => formatUsd(big(v), 6, { compact: true });

/** The card founders share: what is raising, on what terms, and how far along. */
export default async function Image({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const r = /^0x[0-9a-fA-F]{40}$/.test(address) ? await getRaise(address) : null;
  if (!r)
    return renderCard({
      eyebrow: "Raise",
      title: "Raise In Public. Spend By Verdict.",
      sub: "Futarchy fundraising on Monad",
    });
  const sym = `$${displaySymbol(r.symbol)}`;
  const price = formatTokenPrice(big(r.price));
  const q = quoteSym(r.quote);
  if (r.status === "OPEN") {
    const closed = Number(r.end) <= Date.now() / 1000;
    return renderCard({
      eyebrow: closed ? "Raise · Finalizing" : "Raise · Open",
      title: displayName(r.name),
      sub: `${sym} at ${price} in ${q} · one price for every backer`,
      stats: [
        { label: "Committed", value: usd(r.totalContributed) },
        { label: "Goal", value: `${usd(r.minRaise)}–${usd(r.maxRaise)}` },
        { label: closed ? "Closed" : "Closes", value: utcDate(r.end) },
      ],
    });
  }
  if (r.status === "SUCCEEDED")
    return renderCard({
      eyebrow: "Raise · Launched",
      title: displayName(r.name),
      sub: `${sym} · treasury governed by futarchy markets`,
      stats: [
        { label: "Raised", value: usd(r.accepted) },
        { label: "Raise price", value: price },
        { label: "Backers", value: String(r.contributorCount) },
      ],
    });
  return renderCard({
    eyebrow: "Raise · Refunding",
    title: displayName(r.name),
    sub: `${sym} · missed its minimum, every backer is refunded`,
    stats: [
      { label: "Committed", value: usd(r.totalContributed) },
      { label: "Minimum", value: usd(r.minRaise) },
    ],
  });
}
