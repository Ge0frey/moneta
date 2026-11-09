import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { Frame } from "@/components/layout/Frame";
import { ProposalView } from "./ProposalView";

export const metadata: Metadata = { title: "Decision Market" };

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ treasury: string; id: string }>;
}) {
  const { treasury, id } = await params;
  if (!isAddress(treasury) || !/^\d+$/.test(id)) notFound();
  return (
    <Frame>
      <ProposalView treasury={treasury} id={BigInt(id)} />
    </Frame>
  );
}
