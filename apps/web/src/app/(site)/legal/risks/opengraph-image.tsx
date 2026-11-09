import { contentCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Moneta: risks of using Moneta";

export default function Image() {
  return contentCard("/legal/risks");
}
