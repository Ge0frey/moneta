/**
 * schema.org JSON-LD builders (seo.md §4.10). Deliberately absent: Product/Offer/Event/FinancialProduct
 * for raises (misrepresentation, manual-action risk) and the retired sitelinks SearchAction.
 */
import { SAME_AS, SITE_NAME, SITE_TAGLINE, SITE_URL } from "./site";

type Thing = Record<string, unknown>;

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;
const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);

/** Organization + WebSite + WebApplication: who Moneta is, for the home page. */
export function siteGraph(): Thing {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: SITE_NAME,
        alternateName: "Moneta Futarchy",
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: abs("/icon-512.png"), width: 512, height: 512 },
        description: `${SITE_TAGLINE}: raise in public, spend by verdict.`,
        sameAs: SAME_AS,
      },
      {
        "@type": "WebSite",
        "@id": SITE_ID,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: ["Moneta Futarchy", "monetafutarchy.xyz"],
        inLanguage: "en",
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "WebApplication",
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web browser",
        isAccessibleForFree: true,
        description:
          "Permissionless fundraising on Monad where every treasury spend beyond a streamed budget is decided by PASS/FAIL decision markets.",
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}

export function breadcrumbs(items: { name: string; path: string }[]): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

export function article(a: {
  type?: "Article" | "TechArticle";
  headline: string;
  description: string;
  path: string;
  published: string;
  modified: string;
  image?: string;
}): Thing {
  return {
    "@context": "https://schema.org",
    "@type": a.type ?? "Article",
    headline: a.headline,
    description: a.description,
    url: abs(a.path),
    mainEntityOfPage: abs(a.path),
    datePublished: a.published,
    dateModified: a.modified,
    inLanguage: "en",
    // Generated card URLs carry a build hash, so structured data points at the stable brand card.
    image: abs(a.image ?? "/og.png"),
    author: { "@type": "Organization", "@id": ORG_ID, name: SITE_NAME, url: SITE_URL },
    publisher: { "@id": ORG_ID },
  };
}

export function webPage(p: { name: string; description: string; path: string }): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: p.name,
    description: p.description,
    url: abs(p.path),
    isPartOf: { "@id": SITE_ID },
    inLanguage: "en",
  };
}

export function faqPage(items: { q: string; a: string }[]): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function definedTermSet(p: {
  name: string;
  path: string;
  terms: { id: string; term: string; definition: string }[];
}): Thing {
  const url = abs(p.path);
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${url}#set`,
    name: p.name,
    url,
    hasDefinedTerm: p.terms.map((t) => ({
      "@type": "DefinedTerm",
      "@id": `${url}#${t.id}`,
      name: t.term,
      description: t.definition,
      url: `${url}#${t.id}`,
      inDefinedTermSet: `${url}#set`,
    })),
  };
}
