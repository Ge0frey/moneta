import { contentCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Moneta: decision markets, from split to verdict";

export default function Image() {
  return contentCard("/learn/decision-markets");
}
