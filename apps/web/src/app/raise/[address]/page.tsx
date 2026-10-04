import type { Metadata } from "next";
import { isAddress } from "viem";
import { notFound } from "next/navigation";
import { Frame } from "@/components/layout/Frame";
import { RaiseView } from "./RaiseView";

export const metadata: Metadata = { title: "Raise" };

export default async function RaisePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) notFound();
  return (
    <Frame>
      <RaiseView address={address} />
    </Frame>
  );
}
