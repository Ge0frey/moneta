/**
 * Renders schema.org JSON-LD. `<` is escaped (as the Next docs advise) because some values come from
 * user-written raise memos and names.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
