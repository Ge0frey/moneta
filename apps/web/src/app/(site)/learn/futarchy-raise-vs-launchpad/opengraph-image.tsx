import { contentCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Moneta: how a crypto startup should raise its first round";

export default function Image() {
  return contentCard("/learn/futarchy-raise-vs-launchpad");
}
