import Link from "next/link";
import { Frame } from "@/components/layout/Frame";
import { PageHeader } from "@/components/ui/page-header";
import { Eyebrow } from "@/components/ui/pills";
import { pageMetadata } from "@/lib/seo";
import { CreateWizard } from "./CreateWizard";

export const metadata = pageMetadata({
  title: "Create a Raise: Fundraise On-Chain on Monad",
  description:
    "Open a permissionless raise on Monad in minutes: one price for every backer, full refunds below your minimum, a streamed budget and milestone tranches.",
  path: "/create",
});

export default function CreatePage() {
  return (
    <Frame variant="narrative">
      {/* Server-rendered so the heading and intro are in the HTML; the wizard needs a chain read first. */}
      <PageHeader
        eyebrow={<Eyebrow className="w-fit">Create a Raise</Eyebrow>}
        title="Raise with markets, not promises."
        sub={
          <span className="flex flex-col gap-3">
            <span>
              Anyone can open a raise. Backers get one price, a full refund below your minimum, and
              a treasury that only pays out when markets expect it to raise the token&apos;s value.
            </span>
            <span className="mono-xs text-fg-3">
              First raise? Read the{" "}
              <Link href="/founders" className="text-fg-2 underline-offset-2 hover:underline">
                founder guide
              </Link>{" "}
              and{" "}
              <Link href="/docs#raises" className="text-fg-2 underline-offset-2 hover:underline">
                how raises work
              </Link>
              .
            </span>
          </span>
        }
      />
      <CreateWizard />
    </Frame>
  );
}
