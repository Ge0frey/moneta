import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { isAddress, type Address } from "viem";
import { Frame } from "@/components/layout/Frame";
import { JsonLd } from "@/components/seo/JsonLd";
import { isHidden } from "@/lib/hidden";
import { raiseHref } from "@/lib/listing";
import { displayName, raiseMetadata } from "@/lib/seo-onchain";
import { getRaise, isRaiseOnChain } from "@/lib/server/data";
import { breadcrumbs } from "@/lib/structured-data";
import { RaiseView } from "./RaiseView";

/** On-demand ISR: rendered on first request, then served from cache and refreshed every 2 minutes. */
export const revalidate = 120;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const raise = isAddress(address) ? await getRaise(address) : null;
  return raiseMetadata(address, raise);
}

export default async function RaisePage({ params }: Props) {
  const { address } = await params;
  if (!isAddress(address) || isHidden(address)) notFound();
  const lower = address.toLowerCase() as Address;
  if (address !== lower) permanentRedirect(raiseHref(lower));
  const raise = await getRaise(lower);
  // A real 404 only when the chain confirms this isn't a raise; indexer lag or outage never 404s one.
  if (!raise && (await isRaiseOnChain(lower)) === false) notFound();
  return (
    <Frame>
      {raise && (
        <JsonLd
          data={breadcrumbs([
            { name: "Moneta", path: "/" },
            { name: "Explore", path: "/explore" },
            { name: `${displayName(raise.name)} raise`, path: raiseHref(lower) },
          ])}
        />
      )}
      <RaiseView address={lower} initial={raise ?? undefined} />
    </Frame>
  );
}
