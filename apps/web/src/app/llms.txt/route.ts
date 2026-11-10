import { GUIDES, LEARN } from "@/lib/content";
import { GITHUB_URL, SITE_URL } from "@/lib/site";

/**
 * /llms.txt: a Markdown overview for AI tools (an informal convention; search engines don't use it).
 * Generated from the content registry so it never drifts from the real pages.
 */
export const dynamic = "force-static";

const link = (path: string, title: string, description: string) =>
  `- [${title}](${SITE_URL}${path}): ${description}`;

export function GET() {
  const body = [
    "# Moneta",
    "",
    "> Futarchy fundraising on Monad. Founders raise their first round in public at one price for everyone. A successful raise launches a token, a market and a treasury no person controls. The founder draws a streamed budget; every other dollar moves only when a pair of PASS/FAIL decision markets says the spend makes the token worth more. Moneta currently runs on Monad testnet.",
    "",
    "## Docs",
    link(
      "/docs",
      "How Moneta works",
      "Raises, launch, treasury, verdicts, trading, redemption, architecture and security.",
    ),
    ...GUIDES.filter((g) => ["/faq", "/glossary", "/legal/risks"].includes(g.path)).map((g) =>
      link(g.path, g.h1.replace(/\.$/, ""), g.description),
    ),
    "",
    "## Learn",
    ...LEARN.map((a) => link(a.path, a.h1.replace(/\.$/, ""), a.description)),
    "",
    "## Guides",
    ...GUIDES.filter((g) => ["/founders", "/backers", "/about"].includes(g.path)).map((g) =>
      link(g.path, g.title, g.description),
    ),
    "",
    "## App",
    link("/explore", "Explore raises", "Every raise, launched project and live decision market."),
    link(
      "/status",
      "Protocol status",
      "Contract addresses, fees, bounds for new raises and live verdicts.",
    ),
    "",
    "## Source",
    `- [GitHub](${GITHUB_URL}): open-source contracts (Solidity), indexer (Envio HyperIndex), SDK and app.`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
