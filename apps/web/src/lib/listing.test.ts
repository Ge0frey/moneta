import type { IndexedProject, IndexedRaise } from "@moneta/sdk";
import { describe, expect, it } from "vitest";
import { buildListings, listingHref, memoSummary } from "./listing";

const raise = (id: string, status: IndexedRaise["status"]) =>
  ({ id, address: id, status }) as IndexedRaise;
const project = (raiseId: string, state: IndexedProject["state"], active: string | null) =>
  ({
    raise_id: raiseId,
    treasury: `t-${raiseId}`,
    state,
    activeProposal_id: active,
  }) as IndexedProject;

describe("listings", () => {
  it("derives the explore status from raise + project state", () => {
    const l = buildListings(
      [
        raise("a", "OPEN"),
        raise("b", "FAILED"),
        raise("c", "SUCCEEDED"),
        raise("d", "SUCCEEDED"),
        raise("e", "SUCCEEDED"),
      ],
      [project("c", "ACTIVE", null), project("d", "ACTIVE", "d-1"), project("e", "REDEEMED", null)],
    );
    expect(l.map((x) => x.status)).toEqual([
      "raising",
      "refunding",
      "governing",
      "verdict",
      "redeemed",
    ]);
    expect(listingHref(l[0]!)).toBe("/raise/a");
    expect(listingHref(l[2]!)).toBe("/project/t-c");
  });
  it("summarises a memo from its first prose line, without markdown", () => {
    expect(memoSummary("# Title\n\n**Bold** claim with a [link](https://x.y).\n\nMore")).toBe(
      "Bold claim with a link.",
    );
    expect(memoSummary("x".repeat(200), 20)).toHaveLength(20);
  });
});
