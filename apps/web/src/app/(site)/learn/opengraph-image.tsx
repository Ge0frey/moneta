import { OG_CONTENT_TYPE, OG_SIZE, renderCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Learn futarchy and decision markets with Moneta";

export default function Image() {
  return renderCard({
    eyebrow: "Learn",
    title: "Learn Futarchy.",
    sub: "How markets can decide where money goes, and how Moneta uses them on Monad",
  });
}
