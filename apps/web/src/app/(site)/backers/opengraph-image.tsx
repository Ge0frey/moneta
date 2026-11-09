import { contentCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Moneta: back a raise with refunds and market guardrails";

export default function Image() {
  return contentCard("/backers");
}
