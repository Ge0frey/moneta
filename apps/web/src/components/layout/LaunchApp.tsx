import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Marketing-page nav action: the app (and the wallet) live one click away, on /explore. */
export function LaunchApp({ block }: { block?: boolean }) {
  return (
    <Button asChild variant="primary" size="sm" className={block ? "w-full" : undefined}>
      <Link href="/explore">Launch app →</Link>
    </Button>
  );
}
