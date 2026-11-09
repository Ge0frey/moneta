import { Frame } from "@/components/layout/Frame";
import { pageMetadata } from "@/lib/seo";
import { StatusView } from "./StatusView";

export const metadata = pageMetadata({
  title: "Protocol Status, Contracts and Parameters",
  description:
    "Live state of the Moneta deployment on Monad: contract addresses, fees and bounds for new raises, indexer health and every live verdict.",
  path: "/status",
});

export default function StatusPage() {
  return (
    <Frame>
      <StatusView />
    </Frame>
  );
}
