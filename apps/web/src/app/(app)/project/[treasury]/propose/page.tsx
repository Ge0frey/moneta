import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { isAddress } from "viem";
import { Frame } from "@/components/layout/Frame";
import { pageMetadata } from "@/lib/seo";
import { ProposeView } from "./ProposeView";

type Props = { params: Promise<{ treasury: string }> };

/** A form, not content: never indexed. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { treasury } = await params;
  return pageMetadata({
    title: "New Proposal",
    description: "Propose a spend, config change or redemption for a Moneta treasury.",
    path: `/project/${treasury.toLowerCase()}/propose`,
    noindex: true,
  });
}

export default async function ProposePage({ params }: Props) {
  const { treasury } = await params;
  if (!isAddress(treasury)) notFound();
  const lower = treasury.toLowerCase() as `0x${string}`;
  if (treasury !== lower) permanentRedirect(`/project/${lower}/propose`);
  return (
    <Frame>
      <ProposeView treasury={lower} />
    </Frame>
  );
}
