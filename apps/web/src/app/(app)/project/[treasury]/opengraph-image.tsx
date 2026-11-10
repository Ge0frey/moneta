import { big, formatScaledPrice, formatTokenPrice, formatUsd } from "@moneta/sdk";
import { OG_CONTENT_TYPE, OG_SIZE, renderCard } from "@/lib/og";
import { displayName, displaySymbol } from "@/lib/seo-onchain";
import { getProject, getProposals, getRaise } from "@/lib/server/data";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A Moneta project: price, treasury and proposals";
export const revalidate = 120;

export default async function Image({ params }: { params: Promise<{ treasury: string }> }) {
  const { treasury } = await params;
  const p = /^0x[0-9a-fA-F]{40}$/.test(treasury) ? await getProject(treasury) : null;
  if (!p)
    return renderCard({
      eyebrow: "Project",
      title: "Raise In Public. Spend By Verdict.",
      sub: "Futarchy fundraising on Monad",
    });
  const [raise, proposals] = await Promise.all([getRaise(p.raise_id), getProposals(treasury)]);
  const price =
    big(p.lastPrice) > 0n
      ? formatScaledPrice(big(p.lastPrice))
      : raise
        ? formatTokenPrice(big(raise.price))
        : "—";
  const state =
    p.state === "REDEEMED" ? "Redeemed" : p.activeProposal_id ? "In Verdict" : "Governing";
  return renderCard({
    eyebrow: `Project · ${state}`,
    title: displayName(p.name),
    sub: `$${displaySymbol(p.symbol)} · every spend decided by PASS/FAIL markets`,
    stats: [
      { label: "Price", value: price },
      {
        label: "Treasury at launch",
        value: formatUsd(big(p.treasuryQuoteAtLaunch), 6, { compact: true }),
      },
      { label: "Proposals", value: String(proposals?.length ?? p.proposalCount) },
    ],
  });
}
