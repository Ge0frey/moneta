import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { Frame } from "@/components/layout/Frame";
import { ProposeView } from "./ProposeView";

export const metadata: Metadata = { title: "New Proposal" };

export default async function ProposePage({ params }: { params: Promise<{ treasury: string }> }) {
  const { treasury } = await params;
  if (!isAddress(treasury)) notFound();
  return (
    <Frame>
      <ProposeView treasury={treasury} />
    </Frame>
  );
}
