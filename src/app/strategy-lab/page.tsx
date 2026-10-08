import type { Metadata } from "next";
import Link from "next/link";

import { Reveal } from "@/components/reveal";
import { SECTIONS, bySlug, hrefOf } from "@/lib/sections";

/*  THE TOOL, IN FOUR SCREENS.
 *
 *  Every other page on this site argues from numbers. This one argues from the
 *  thing that produced them: a reader who wants to know whether the research
 *  is a pile of notebooks or an actual system can see the system.
 *
 *  Shots are PNGs under /public/lab, captured from the running app rather than
 *  mocked up — a mock would be the one dishonest thing on a site about being
 *  checkable. They are stills on purpose: the lab talks to a live broker
 *  account and is not going on the public internet.
 */
const meta = bySlug("strategy-lab")!;

export const metadata: Metadata = {
  title: "Strategy Lab — Chutithep Engmahussakul",
  description: meta.blurb,
};

const STEPS = [
  {
    n: "01",
    title: "Data",
    src: "/lab/01-data.png",
    alt: "The data inventory: every instrument, its broker, date range, row count and last download.",
    lead: "One inventory, one source of truth.",
    body: "Every instrument is stored as M1 parquet pulled straight from the broker, with its coverage, row count and last refresh on the row. A backtest that silently runs on stale or short history is the easiest way to believe something false, so coverage is a first-class field rather than something to remember.",
  },
  {
    n: "02",
    title: "Engine",
    src: "/lab/02-engine.png",
    alt: "The engine registry: each strategy family, its versions, and its Python-to-MQL5 parity status.",
    lead: "Research runs in Python. Live runs in MQL5.",
    body: "Every test is run by the Python engine, but every live trade is placed by an MQL5 Expert Advisor on MetaTrader 5 — two separate implementations of the same strategy. So each version has to pass a parity test: the same window, trade by trade, until the two agree. If they disagree, what would get deployed is not what was tested, and the version does not go out.",
  },
  {
    n: "03",
    title: "Sweep",
    src: "/lab/03-sweep.png",
    alt: "The sweep builder and the queue of completed sweeps with their configuration counts.",
    lead: "Looking for a plateau, not a winner.",
    body: "The point of running a whole grid is not to find the single best configuration — that number is mostly luck. It is to find a RANGE of settings that all work, and that still work on the window the search never saw. So the out-of-sample cutoff is fixed when the run is defined, in-sample and out-of-sample metrics are stored separately, and what gets promoted is a region holding up in both. A lone spike, however tall, is a coordinate rather than an edge.",
  },
  {
    n: "04",
    title: "Portfolio",
    src: "/lab/04-portfolio.png",
    alt: "The portfolio builder: candidate strategies with their drawdown, return and Calmar, and a drawdown budget to fit them into.",
    lead: "Sized against one drawdown budget, together.",
    body: "Candidates are not judged alone. The optimiser fits them to a single portfolio drawdown budget on one shared balance, using only the fitted window, and the held-out window is scored once afterwards. This is where a strategy that looks excellent by itself can still lose its place: if it moves with something the book already holds, it adds risk without adding return, and the budget is better spent elsewhere.",
  },
];

export default function StrategyLab() {
  const i = SECTIONS.findIndex((s) => s.slug === meta.slug);
  const next = SECTIONS[(i + 1) % SECTIONS.length];

  return (
    <div className="py-14 sm:py-20">
      <Reveal>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {meta.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {meta.label}
        </h1>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
          {meta.blurb}
        </p>
      </Reveal>

      <div className="mt-14 space-y-16 sm:space-y-20">
        {STEPS.map((s) => (
          <Reveal key={s.n}>
            <section className="border-t border-border pt-8">
              {/*  Caption ABOVE, screenshot FULL WIDTH below. Side by side gave
                   the image 58% of the column and a 1400px dashboard shot
                   rendered at 800px is a picture of a dashboard, not a
                   dashboard you can read.                                   */}
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    <span className="text-foreground/40">{s.n}</span> &mdash; {s.title}
                  </p>
                  <h2 className="mt-3 max-w-[22ch] text-[clamp(1.5rem,2.6vw,2rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-balance">
                    {s.lead}
                  </h2>
                </div>
                <p className="max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>

              <figure className="mt-7 overflow-hidden rounded-xl border border-border bg-card">
                {/*  Plain <img>: fixed-size stills on a statically exported
                     site, so the optimiser has nothing to do but add a build
                     step that export mode then has to be told to skip.      */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.src}
                  alt={s.alt}
                  className="block w-full"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            </section>
          </Reveal>
        ))}
      </div>

      <nav className="mt-16 border-t border-border pt-6">
        <Link
          href={hrefOf(next)}
          className="group inline-flex items-baseline gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]">Next</span>
          <span className="text-foreground">{next.label}</span>
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            &rarr;
          </span>
        </Link>
      </nav>
    </div>
  );
}
