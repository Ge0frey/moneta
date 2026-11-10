import { big, formatScaledPrice } from "@moneta/sdk";
import { OG_CONTENT_TYPE, OG_SIZE, renderCard } from "@/lib/og";
import { displayName, displaySymbol, proposalActionTitle, utcDate } from "@/lib/seo-onchain";
import { getProject, getProposal } from "@/lib/server/data";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A Moneta decision market: PASS vs FAIL";
export const revalidate = 120;

const STATE = {
  QUEUED: "Queued",
  ACTIVE: "Live",
  PASSED: "Passed",
  EXECUTED: "Executed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
} as const;

export default async function Image({
  params,
}: {
  params: Promise<{ treasury: string; id: string }>;
}) {
  const { treasury, id } = await params;
  const ok = /^0x[0-9a-fA-F]{40}$/.test(treasury) && /^\d{1,9}$/.test(id);
  const [pr, p] = ok
    ? await Promise.all([getProposal(treasury, id), getProject(treasury)])
    : [null, null];
  if (!pr)
    return renderCard({
      eyebrow: "Decision market",
      title: "Two markets. One verdict.",
      sub: "Futarchy fundraising on Monad",
    });
  const twap = (v: string | null) => (v ? formatScaledPrice(big(v)) : "—");
  const decided = pr.status === "PASSED" || pr.status === "EXECUTED" || pr.status === "FAILED";
  return renderCard({
    eyebrow: `Proposal #${id} · ${STATE[pr.status]}`,
    title: proposalActionTitle(pr),
    sub: p ? `${displayName(p.name)} · $${displaySymbol(p.symbol)}` : "A Moneta decision market",
    stats: [
      { label: "PASS TWAP", value: twap(pr.twapPass) },
      { label: "FAIL TWAP", value: twap(pr.twapFail) },
      decided
        ? { label: "Verdict", value: pr.passed ? "PASS" : "FAIL" }
        : { label: "Decided by", value: pr.tradingEnd ? utcDate(pr.tradingEnd) : "—" },
    ],
  });
}
