import { OG_CONTENT_TYPE, OG_SIZE, renderCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "How Moneta works: raises, verdicts and treasuries";

export default function Image() {
  return renderCard({
    eyebrow: "Docs",
    title: "How Moneta Works.",
    sub: "Raises, decision markets, lagging-TWAP verdicts and treasuries no one controls",
    stats: [
      { label: "Raises", value: "One price" },
      { label: "Spending", value: "By verdict" },
      { label: "Block time", value: "300 ms" },
    ],
  });
}
