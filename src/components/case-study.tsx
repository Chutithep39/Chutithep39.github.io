import {
  BacktestCurve,
  BacktestTable,
} from "@/components/backtest-curve";
import {
  BaselineHistogram,
  SignificanceTable,
} from "@/components/baseline-histogram";
import { CandidateCorrelation } from "@/components/candidate-correlation";
import { Reveal } from "@/components/reveal";
import type { Block, CaseStudy, Table } from "@/data/case-studies";

const FIGURES = {
  "baseline-histogram": BaselineHistogram,
  "significance-table": SignificanceTable,
  "backtest-curve": BacktestCurve,
  "backtest-table": BacktestTable,
  "candidate-correlation": CandidateCorrelation,
} as const;

/*  One write-up, in the order a reader interrogates it: what was claimed, what
 *  would have falsified it, how it was measured, what came back, and what the
 *  test still could not settle.
 *
 *  Built for reading, not for density. The previous version ran everything at
 *  one size in one column of grey, so a reader had no way in and no way to
 *  skim — the numbered falsifiers looked exactly like the prose around them
 *  and the finding looked exactly like its own footnote. Three things fix
 *  that: a `lede` line per section that carries the point on its own, section
 *  headings in the left margin on a wide screen so the spine is visible while
 *  reading, and body text at a size meant for paragraphs rather than for
 *  labels.
 */

const TONE = {
  additivity: { ring: "border-[#cb3cff]/45", text: "text-[#cb3cff]" },
  cost: { ring: "border-[#ffb02e]/45", text: "text-[#ffb02e]" },
} as const;

function DataTable({ table }: { table: Table }) {
  const marked = new Set(table.mark ?? []);
  return (
    <figure className="mt-6">
      {table.caption && (
        <figcaption className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          {table.caption}
        </figcaption>
      )}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[520px] font-mono text-[12px] tabular-nums">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {table.head.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={[
                    "border-b border-border px-4 py-3 font-normal",
                    i === 0 ? "text-left" : "text-right",
                  ].join(" ")}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr
                key={r}
                className={[
                  r > 0 ? "border-t border-border/50" : "",
                  //  The finding, not every number around it. A table where
                  //  nothing is emphasised makes the reader hunt for the line
                  //  the paragraph underneath is about.
                  marked.has(r) ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={[
                      "px-4 py-2.5",
                      c === 0 ? "whitespace-nowrap text-left" : "text-right",
                    ].join(" ")}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note && (
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          {table.note}
        </p>
      )}
    </figure>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === "lede") {
          //  Same rule as a quote. These are the two load-bearing sentences of
          //  the page and they sit one under the other — giving one a rule and
          //  the other none made the difference look like it meant something.
          return (
            <p
              key={i}
              className="mt-6 -ml-5 border-l-2 border-border pl-5 text-[17px] font-medium leading-relaxed text-foreground text-balance first:mt-0 max-w-2xl"
            >
              {b.text}
            </p>
          );
        }
        if (b.kind === "quote") {
          return (
            //  The rule HANGS into the margin: with a plain `pl-5` the quote's
            //  text started 20px right of every paragraph around it, and the
            //  column lost its left edge.
            <figure key={i} className="mt-6 -ml-5 max-w-2xl border-l-2 border-border pl-5 first:mt-0">
              <blockquote className="text-[16px] leading-relaxed text-foreground text-balance">
                {b.text}
              </blockquote>
              {b.cite && (
                <figcaption className="mt-2 font-mono text-[11px] text-muted-foreground">
                  {b.cite}
                </figcaption>
              )}
            </figure>
          );
        }
        if (b.kind === "p") {
          return (
            <p
              key={i}
              className="mt-4 text-[15px] leading-[1.75] text-muted-foreground first:mt-0 max-w-2xl"
            >
              {b.text}
            </p>
          );
        }
        if (b.kind === "figure") {
          const Figure = FIGURES[b.id];
          return <Figure key={i} />;
        }
        if (b.kind === "placeholder") {
          return (
            <p
              key={i}
              className="mt-5 max-w-2xl rounded-xl border border-dashed border-border bg-card/40 px-5 py-8 font-mono text-[12px] text-muted-foreground"
            >
              {b.text}
            </p>
          );
        }
        if (b.kind === "qa") {
          //  Question then answer, as a definition list. Prose would have to
          //  carry the ambiguity and its resolution in the same sentence; this
          //  lets a reader scan only the questions and stop at the one they
          //  were about to ask.
          return (
            <dl key={i} className="mt-5 max-w-2xl divide-y divide-border border-y border-border">
              {b.items.map((it) => (
                <div key={it.q} className="py-4">
                  <dt className="text-[15px] font-medium leading-snug text-foreground">
                    {it.q}
                  </dt>
                  <dd className="mt-1.5 text-[14px] leading-[1.7] text-muted-foreground">
                    {it.a}
                  </dd>
                </div>
              ))}
            </dl>
          );
        }
        if (b.kind === "list") {
          return (
            <ol key={i} className="mt-5 max-w-2xl space-y-4">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-4">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[10px] text-muted-foreground">
                    {j + 1}
                  </span>
                  <span className="text-[15px] leading-[1.75] text-muted-foreground">
                    {it}
                  </span>
                </li>
              ))}
            </ol>
          );
        }
        return <DataTable key={i} table={b.table} />;
      })}
    </>
  );
}

export function CaseStudyView({ study }: { study: CaseStudy }) {
  const tone = TONE[study.cause];
  return (
    <article id={study.slug} className="scroll-mt-20">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={[
              "rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
              tone.ring,
              tone.text,
            ].join(" ")}
          >
            {study.verdict}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {study.killedBy}
          </span>
        </div>

        <h2 className="mt-4 max-w-3xl text-[28px] font-semibold leading-tight tracking-tight text-balance sm:text-[32px]">
          {study.title}
        </h2>
        {/*  The claim in plain words, before any apparatus. A reader who stops
            here should still be able to say what was tested.               */}
        <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted-foreground text-balance">
          {study.oneLine}
        </p>

        {/*  The instruments / window / hold strip lived here and is pulled for
            now: it front-loaded apparatus before the reader had been told
            what the apparatus was for. The same facts are stated in Method,
            where they are load-bearing. `meta` stays on the type so it can go
            back in once there is more around it to anchor.                 */}
        <div className="mt-7 border-b border-border" />
      </header>

      <div className="mt-12 space-y-14">
        {study.parts.map((part) => (
          <section key={part.title} className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-12">
            {/*  On a wide screen the headings sit in the margin, so the spine
                of the argument stays visible while the body is read. On a
                narrow one they fall back above their section.            */}
            <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground lg:sticky lg:top-20 lg:self-start lg:pt-1">
              {part.title}
            </h3>
            {/*  The column is NOT capped here. Prose carries its own
                `max-w-2xl` so it keeps a readable measure, while charts and
                tables take the full width — they were being squeezed into a
                672px box with half the page empty beside them.          */}
            <Reveal className="mt-3 lg:mt-0">
              <Blocks blocks={part.blocks} />
            </Reveal>
          </section>
        ))}
      </div>
    </article>
  );
}
