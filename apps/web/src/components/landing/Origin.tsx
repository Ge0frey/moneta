import { Index } from "./SectionHead";

const SENSES = [
  {
    body: (
      <>
        Epithet of Juno: <em className="text-fg not-italic">she who warns</em>, from <em>monēre</em>
        , to warn. Rome struck its coins at her temple on the Capitoline.
      </>
    ),
    tone: "body-lg text-fg-2",
  },
  {
    body: (
      <>
        The word that became <em className="text-fg not-italic">money</em> and{" "}
        <em className="text-fg not-italic">mint</em>.
      </>
    ),
    tone: "body-lg text-fg-2",
  },
  {
    body: "A treasury that heeds the warning. Capital moves only when a market, with money at stake, says it creates value.",
    tone: "heading-lg text-fg",
  },
];

/** VI. Origin — the name, set as a dictionary entry. */
export function Origin() {
  return (
    <div className="grid items-start gap-y-10 lg:grid-cols-4">
      <Index n="VI" label="Origin" className="lg:pt-6" />
      <article className="lg:col-span-3 lg:pl-6" aria-labelledby="origin-word">
        <p className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <dfn id="origin-word" className="display-lg not-italic">
            Moneta
          </dfn>
          <span className="mono-md text-fg-3">/moˈneː.ta/</span>
          <span className="label-mono text-fg-3">noun · Latin</span>
        </p>
        <ol className="mt-10 flex flex-col gap-7">
          {SENSES.map((s, i) => (
            <li key={i} className="grid grid-cols-[2.5rem_1fr] items-baseline">
              <span className="mono-sm text-fg-3">{i + 1}.</span>
              <p className={`${s.tone} max-w-[44ch]`}>{s.body}</p>
            </li>
          ))}
        </ol>
      </article>
    </div>
  );
}
