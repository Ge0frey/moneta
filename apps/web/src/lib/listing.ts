import type { IndexedProject, IndexedRaise } from "@moneta/sdk";
import type { StatusTone } from "@/components/ui/pills";

/** A raise joined with its launched project — the unit shown on Explore and the landing carousel. */
export type Listing = {
  raise: IndexedRaise;
  project?: IndexedProject;
  status: ListingStatus;
};

export type ListingStatus = "raising" | "refunding" | "governing" | "verdict" | "redeemed";

export const STATUS_META: Record<
  ListingStatus,
  { label: string; tone: StatusTone; filter: string }
> = {
  raising: { label: "Raising", tone: "accent", filter: "Raising" },
  refunding: { label: "Refunding", tone: "warning", filter: "Refunding" },
  governing: { label: "Governing", tone: "live", filter: "Governing" },
  verdict: { label: "In Verdict", tone: "live", filter: "In Verdict" },
  redeemed: { label: "Redeemed", tone: "muted", filter: "Redeemed" },
};

export function buildListings(
  raises: IndexedRaise[] = [],
  projects: IndexedProject[] = [],
): Listing[] {
  const byRaise = new Map(projects.map((p) => [p.raise_id, p]));
  return raises.map((raise) => {
    const project = byRaise.get(raise.id);
    let status: ListingStatus = "raising";
    if (raise.status === "FAILED") status = "refunding";
    else if (raise.status === "SUCCEEDED") {
      if (project?.state === "REDEEMED") status = "redeemed";
      else status = project?.activeProposal_id ? "verdict" : "governing";
    }
    return { raise, project, status };
  });
}

/** First prose line of a Markdown memo (skips headings), plain text, for cards. */
export function memoSummary(memo: string, max = 140): string {
  const line =
    memo
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#")) ?? "";
  const plain = line.replace(/[*_`>#\[\]]/g, "").replace(/\(([^)]+)\)/g, "");
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}

export function listingHref(l: Listing): string {
  if (l.raise.status === "SUCCEEDED" && l.project) return `/project/${l.project.treasury}`;
  return `/raise/${l.raise.address}`;
}
