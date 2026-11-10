import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { isAddress, type Address } from "viem";
import { Frame } from "@/components/layout/Frame";
import { JsonLd } from "@/components/seo/JsonLd";
import { isHidden } from "@/lib/hidden";
import { projectHref } from "@/lib/listing";
import { displayName, projectMetadata } from "@/lib/seo-onchain";
import { getProject, getProposals, getRaise, isTreasuryOnChain } from "@/lib/server/data";
import { breadcrumbs } from "@/lib/structured-data";
import { ProjectView } from "./ProjectView";

export const revalidate = 120;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ treasury: string }> };

async function load(treasury: string) {
  const project = await getProject(treasury);
  const [proposals, raise] = await Promise.all([
    project ? getProposals(treasury) : null,
    project ? getRaise(project.raise_id) : null,
  ]);
  return { project, proposals, raise };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { treasury } = await params;
  if (!isAddress(treasury)) return projectMetadata(treasury, null, null, null);
  const d = await load(treasury);
  return projectMetadata(treasury, d.project, d.raise, d.proposals);
}

export default async function ProjectPage({ params }: Props) {
  const { treasury } = await params;
  if (!isAddress(treasury) || isHidden(treasury)) notFound();
  const lower = treasury.toLowerCase() as Address;
  if (treasury !== lower) permanentRedirect(projectHref(lower));
  const initial = await load(lower);
  if (!initial.project && (await isTreasuryOnChain(lower)) === false) notFound();
  return (
    <Frame>
      {initial.project && (
        <JsonLd
          data={breadcrumbs([
            { name: "Moneta", path: "/" },
            { name: "Explore", path: "/explore" },
            { name: displayName(initial.project.name), path: projectHref(lower) },
          ])}
        />
      )}
      <ProjectView treasury={lower} initial={initial} />
    </Frame>
  );
}
