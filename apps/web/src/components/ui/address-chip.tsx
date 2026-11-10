import { explorerAddressUrl, shortAddress } from "@moneta/sdk";
import { CHAIN_ID } from "@/lib/env";
import { CopyButton } from "./copy-button";

/**
 * Server-rendered address chip for reading pages (docs, status copy): the SDK runs on the server, and only
 * the copy button ships to the browser. App views keep using AddressChip from display.tsx.
 */
export function ServerAddressChip({ address, label }: { address: string; label?: string }) {
  const url = explorerAddressUrl(CHAIN_ID, address);
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap mono-xs text-fg-2">
      {label && <span className="text-fg-3">{label}</span>}
      <CopyButton text={address}>{shortAddress(address)}</CopyButton>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-fg"
          aria-label="Open in explorer"
        >
          ↗
        </a>
      )}
    </span>
  );
}
