import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { isAddress, type Address } from "viem";
import { Frame } from "@/components/layout/Frame";
import { JsonLd } from "@/components/seo/JsonLd";
import { isHidden } from "@/lib/hidden";
import { projectHref, proposalHref } from "@/lib/listing";
import { displayName, proposalActionTitle, proposalMetadata } from "@/lib/seo-onchain";
import { getProject, getProposal, getRaise, isTreasuryOnChain } from "@/lib/server/data";
import { breadcrumbs } from "@/lib/structured-data";
import { ProposalView } from "./ProposalView";

export const revalidate = 120;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ treasury: string; id: string }> };

const validId = (id: string) => /^\d{1,9}$/.test(id) && id === String(Number(id));

async function load(treasury: string, id: string) {
  const [proposal, project] = await Promise.all([getProposal(treasury, id), getProject(treasury)]);
  const raise = project ? await getRaise(project.raise_id) : null;
  return { proposal, project, raise };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { treasury, id } = await params;
  if (!isAddress(treasury) || !validId(id)) return proposalMetadata(treasury, id, null, null, null);
  const d = await load(treasury, id);
  return proposalMetadata(treasury, id, d.proposal, d.project, d.raise);
}

export default async function ProposalPage({ params }: Props) {
  const { treasury, id } = await params;
  if (!isAddress(treasury) || !validId(id) || isHidden(treasury)) notFound();
  const lower = treasury.toLowerCase() as Address;
  if (treasury !== lower) permanentRedirect(proposalHref(lower, id));
  const d = await load(lower, id);
  if (!d.project && (await isTreasuryOnChain(lower)) === false) notFound();
  return (
    <Frame>
      {d.proposal && d.project && (
        <JsonLd
          data={breadcrumbs([
            { name: "Moneta", path: "/" },
            { name: "Explore", path: "/explore" },
            { name: displayName(d.project.name), path: projectHref(lower) },
            {
              name: `Proposal #${id}: ${proposalActionTitle(d.proposal)}`,
              path: proposalHref(lower, id),
            },
          ])}
        />
      )}
      <ProposalView
        treasury={lower}
        id={BigInt(id)}
        initial={{ proposal: d.proposal, project: d.project }}
      />
    </Frame>
  );
}
