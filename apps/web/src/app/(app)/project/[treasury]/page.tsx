import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { Frame } from "@/components/layout/Frame";
import { ProjectView } from "./ProjectView";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ treasury: string }> }) {
  const { treasury } = await params;
  if (!isAddress(treasury)) notFound();
  return (
    <Frame>
      <ProjectView treasury={treasury} />
    </Frame>
  );
}
