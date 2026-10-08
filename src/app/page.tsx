import type { Metadata } from "next";
import Link from "next/link";

import { HomeCurve } from "@/components/home-curve";
import { HomeTour } from "@/components/home-tour";
import { SweepSurface } from "@/components/sweep-surface";
import { Reveal } from "@/components/reveal";
import data from "@/data/portfolio99.json";
import SWEEP from "@/data/sweep-surface.json";

/*  HOME.
 *
 *  The site used to open straight onto the equity curve, which answered "how
 *  did it do" before a reader had any reason to care what "it" was. This page
 *  answers the earlier questions — who, how, and by what standard — and hands
 *  off to /results for the evidence and /kill-log for a worked example.
 *
 *  EVERY FIGURE ON THIS PAGE IS READ OUT OF portfolio99.json, never typed in.
 *  The daily export rewrites that file; a hard-coded number here would be a
 *  claim that silently goes stale.
 */

type Stats = {
  from: string;
  to: string;
  years: number;
  n_trades: number;
  return_pct: number;
  cagr_pct: number;
  max_dd_pct: number;
  calmar: number | null;
  sharpe: number | null;
};
type Band = { key: string; label: string; from: string; to: string; stats: Stats };

const BANDS = data.bands as Band[];
/*  The side panel counts the LIVE window only. The backtest's 14,003 trades
    are history the strategies were researched on, not a record of trading —
    putting them under "Independent research, 2026–Present" read as a claim of
    eight years of live activity, which is false.                           */
const LIVE = BANDS.find((b) => b.key === "recent")!.stats;
const BENCH = data.benchmark as {
  label: string;
  stats: Stats;
  by: Record<string, Stats>;
};
const BENCH_LIVE = BENCH.by.recent;

export const metadata: Metadata = {
  title: "Chutithep Engmahussakul — Quantitative trading research",
  description:
    "A systematic trading research practice: stated hypotheses, criteria fixed before the data is touched, costs charged at the traded minute, and a held-out window scored once.",
};

export default function Home() {
  return (
    <div className="pb-4">
      <HomeTour />
      <Hero />
      <Context />
      <Framework />
      <Lab />
      <Snapshot />
      <Outcomes />
    </div>
  );
}

/* ---------------------------------------------------------------- hero -- */

function Hero() {
  return (
    <section
      data-tour="hero"
      className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.35fr_0.65fr] lg:gap-16"
    >
      <Reveal>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Quantitative trading research
        </p>
        <h1 className="mt-5 max-w-[16ch] text-[clamp(2.6rem,6vw,4.4rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-balance">
          A research practice,{" "}
          <span className="grad-primary-text">built to survive scrutiny.</span>
        </h1>
        <p className="mt-7 max-w-[62ch] text-[17px] leading-relaxed text-muted-foreground">
          I build and evaluate systematic trading strategies end to end — from
          hypothesis and mechanism to statistical testing, backtesting,
          out-of-sample validation, portfolio fit, and live deployment.
        </p>

        <Pipeline />

        <div className="mt-9 flex flex-wrap gap-3">
          <Button href="/results" primary>
            See the evidence
          </Button>
          <Button href="/kill-log">How I research</Button>
        </div>
      </Reveal>

      <Reveal delay={120} className="self-end">
        <div className="border-border lg:border-l lg:pl-8">
          <SideFact label="Independent research" big="2026 – Present">
            Self-directed systematic trading research
          </SideFact>

          {/*  Three columns rather than one "8 / 5 / 303" string: the slashes
              put every label under the wrong number, because "Instruments" is
              four times the width of the 5 it belongs to.                  */}
          <div className="mt-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Deployed book
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-x-4">
              {[
                [String(data.members), "Strategies"],
                [String((data.assets as string[]).length), "Instruments"],
                [fmtInt(LIVE.n_trades), "Live trades"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dd className="font-mono text-[clamp(1.5rem,2.6vw,1.9rem)] font-semibold leading-none tracking-tight">
                    {n}
                  </dd>
                  <dt className="mt-2 text-[12px] leading-snug text-muted-foreground">
                    {l}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

const PIPELINE = ["Hypothesize", "Test", "Validate", "Diversify", "Deploy"];

function Pipeline() {
  return (
    <ol className="mt-8 flex flex-wrap items-center gap-x-2.5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.12em]">
      {PIPELINE.map((s, i) => (
        <li key={s} className="flex items-center gap-2.5">
          <span className="text-foreground/80">{s}</span>
          {i < PIPELINE.length - 1 && (
            <span aria-hidden className="text-muted-foreground/45">
              &rarr;
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Button({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "group inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium transition-colors",
        primary
          ? "grad-primary text-primary-foreground hover:opacity-90"
          : "border border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground",
      ].join(" ")}
    >
      {children}
      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
        &rarr;
      </span>
    </Link>
  );
}

function SideFact({
  label,
  big,
  children,
}: {
  label: string;
  big: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2.5 font-mono text-[clamp(1.6rem,3vw,2.1rem)] font-semibold leading-none tracking-tight">
        {big}
      </p>
      <p className="mt-2 text-[13px] text-muted-foreground">{children}</p>
    </div>
  );
}

/* ------------------------------------------------------------- section -- */

function SectionHead({
  number,
  eyebrow,
  title,
  intro,
}: {
  number: string;
  eyebrow: string;
  title: React.ReactNode;
  intro: string;
}) {
  return (
    <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="text-foreground/40">{number}</span> — {eyebrow}
        </p>
        <h2 className="mt-3 text-[clamp(1.75rem,3.2vw,2.35rem)] font-semibold leading-[1.08] tracking-[-0.025em] text-balance">
          {title}
        </h2>
      </div>
      <p className="max-w-[48ch] text-[15px] leading-relaxed text-muted-foreground">
        {intro}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ context --- */

const PRINCIPLES = [
  {
    h: "Hypothesis-driven",
    p: "Start from a mechanism — why the behaviour should exist — and write down what would falsify it.",
  },
  {
    h: "Criteria fixed first",
    p: "Pass/fail thresholds are set before the data is touched, so a result cannot be re-framed into a pass.",
  },
  {
    h: "Costs at the traded minute",
    p: "Spread and commission are charged on the bar the trade actually fills, not added afterwards as a flat haircut.",
  },
  {
    h: "Portfolio fit decides",
    p: "A strategy has to improve the book. Standalone performance that duplicates risk already held is a kill.",
  },
];

function Context() {
  return (
    <Section>
      <Reveal>
        <SectionHead
          number="01"
          eyebrow="Context"
          title={
            <>
              From data &amp; BI
              <br />
              to quantitative research.
            </>
          }
          intro="After 7+ years in analytics and BI across e-commerce and retail, I turned a long-running interest in systematic trading into a structured research practice."
        />
      </Reveal>

      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {PRINCIPLES.map((x, i) => (
          <Reveal key={x.h} delay={i * 70}>
            <div className="flex h-full flex-col bg-card p-6">
              <p className="font-mono text-[11px] text-muted-foreground/60">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-8 text-[17px] font-semibold tracking-tight">
                {x.h}
              </h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                {x.p}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------- framework -- */

const FLOW = [
  "Hypothesis",
  "Mechanism",
  "Define the test",
  "Analyse",
  "Backtest",
  "Robustness",
  "Out-of-sample",
  "Portfolio fit",
  "Deploy / kill",
];

function Framework() {
  return (
    <Section>
      <Reveal>
        <SectionHead
          number="02"
          eyebrow="Research framework"
          title="How I research."
          intro="The process is built to make selection a research decision rather than a search for the best-looking backtest."
        />
      </Reveal>

      <Reveal>
        <ol className="flex flex-wrap items-center gap-2">
          {FLOW.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={[
                  "rounded-lg border px-3 py-2 text-[12px] font-medium",
                  i === FLOW.length - 1
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground",
                ].join(" ")}
              >
                {s}
              </span>
              {i < FLOW.length - 1 && (
                <span aria-hidden className="text-muted-foreground/35">
                  &rarr;
                </span>
              )}
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal>
        <p className="mt-6 text-[14px] leading-relaxed text-muted-foreground">
          One candidate is written up against every step of it, kill included —{" "}
          <Link
            href="/kill-log"
            className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground/40"
          >
            read the write-up
          </Link>
          .
        </p>
      </Reveal>
    </Section>
  );
}

/* ----------------------------------------------------------------- lab -- */

/*  THE TOOLING SECTION.
 *
 *  It used to be a list of what the lab does next to a column of inventory
 *  counts — instruments held, bars on disk. True, and no reader is more
 *  convinced by a file count. What actually separates this from a spreadsheet
 *  is visible in one picture: a sweep searched as a surface, scored on a
 *  window that was held back. So the picture is the section.
 */
function Lab() {
  return (
    <Section>
      <Reveal>
        <SectionHead
          number="03"
          eyebrow="Research infrastructure"
          title={
            <>
              Not guesswork —
              <br />
              a tool I built for it.
            </>
          }
          intro="Strategy Lab is my own backtest engine, data lake and dashboard. It searches a whole parameter space at once, scores every candidate on identical metric definitions, and keeps the fitted window and the held-out window apart from the first run."
        />
      </Reveal>

      <Reveal>
        <div data-tour="surface">
          <SweepSurface />
        </div>
      </Reveal>

      <Reveal>
        <p className="mt-5 text-[14px] leading-relaxed text-muted-foreground">
          <Link
            href="/strategy-lab"
            className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground/40"
          >
            See the tool itself
          </Link>{" "}
          &mdash; data, engine, sweep, portfolio, in four screens.
        </p>
      </Reveal>

      <Reveal>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Finding label="Why height, not just colour">
            A flat heatmap makes a lone spike and a broad rise the same shade.
            Lifted into height, the difference is the first thing you see — and
            it is the difference between a setting that happened to fit and a
            region the strategy is actually stable in.
          </Finding>
          <Finding label="Why a plateau and not a maximum">
            The best single cell on this grid scores{" "}
            <b className="font-medium text-foreground">{SWEEP.peaks[0].is}</b>{" "}
            and its neighbours average{" "}
            <b className="font-medium text-foreground">{SWEEP.peaks[0].around}</b>.
            One step off any parameter and most of it is gone. The marked region
            holds {SWEEP.plateau.n} adjacent settings whose worst member still
            scores {SWEEP.plateau.is_min} &mdash; that is what gets deployed,
            because live trading never lands exactly on a coordinate.
          </Finding>
        </div>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------ snapshot -- */

function Snapshot() {
  /*  PLAIN, NOT ANNUALISED. Ten weeks scaled to a year turns 27.9% into a
      152% CAGR and a Calmar near 50 — arithmetically correct and completely
      misleading. The window's own return, its own drawdown, and the index
      over the same days are the only figures this little data supports.   */
  const metrics = [
    { v: `+${pct(LIVE.return_pct)}`, l: "Return, this window" },
    { v: pct(LIVE.max_dd_pct), l: "Maximum drawdown" },
    { v: `+${pct(BENCH_LIVE.return_pct)}`, l: `${BENCH.label}, same days` },
    { v: fmtInt(LIVE.n_trades), l: "Trades" },
  ];

  return (
    <Section>
      <Reveal>
        <SectionHead
          number="04"
          eyebrow="Current portfolio"
          title={
            <>
              What survived
              <br />
              the process.
            </>
          }
          intro="Construction weighs standalone performance, robustness, out-of-sample behaviour, and correlation with what is already deployed."
        />
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_0.55fr]">
        <Reveal>
          <div
            data-tour="snapshot"
            className="h-full rounded-xl border border-border bg-card p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium">
                Live window &middot; {longDate(LIVE.from)} &ndash; {longDate(LIVE.to)}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                ${fmtInt(data.start_balance as number)} fixed size · net of costs
              </p>
            </div>
            <div className="mt-5">
              <HomeCurve />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
              <Key color="var(--chart-1)">Deployed portfolio</Key>
              <Key color="var(--muted-foreground)" dashed>
                {BENCH.label}
              </Key>
            </div>
          </div>
        </Reveal>

        <Reveal delay={110}>
          <div className="grid h-full gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-1">
            {metrics.map((m) => (
              <div key={m.l} className="bg-card p-5">
                <p className="font-mono text-[1.6rem] font-semibold leading-none tracking-tight">
                  {m.v}
                </p>
                <p className="mt-2 text-[12px] text-muted-foreground">{m.l}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      <Reveal>
        <p className="mt-4 max-w-[80ch] text-[12px] leading-relaxed text-muted-foreground">
          This is the window the book is trading now &mdash; {LIVE.n_trades}{" "}
          trades over {Math.round(LIVE.years * 12)} months, which is a progress
          check and not a track record. The eight years behind it, split into the
          fitted window and the held-out one that was scored once, are on the
          results page.{" "}
          <Link
            href="/results"
            className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground/40"
          >
            Check the numbers yourself
          </Link>
          .
        </p>
      </Reveal>
    </Section>
  );
}

function Key({
  color,
  dashed = false,
  children,
}: {
  color: string;
  dashed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-0 w-6 shrink-0 rounded-full"
        style={{
          borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}`,
          opacity: dashed ? 0.6 : 1,
        }}
      />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------ outcomes -- */

/*  ONE example, not three.
 *
 *  The other two cards were labelled "write-up pending", which is an honest
 *  label for an empty card and still an empty card — two-thirds of the section
 *  was a promise. One kill with the whole reasoning attached makes the point
 *  the section exists to make; a second adds nothing until it is written.
 */
function Outcomes() {
  return (
    <Section last>
      <Reveal>
        <SectionHead
          number="05"
          eyebrow="Research outcomes"
          title={
            <>
              Not every strategy
              <br />
              should survive.
            </>
          }
          intro="Most candidates are rejected, and the reason is recorded. Here is one of them, worked through end to end."
        />
      </Reveal>

      <Reveal>
        <article
          data-tour="outcome"
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
            <div>
              <span className="inline-block rounded-md border border-destructive/35 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-destructive">
                Example of a killed strategy
              </span>
              <h3 className="mt-6 text-[clamp(1.4rem,2.4vw,1.75rem)] font-semibold tracking-tight">
                Buy the dip on NASDAQ
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                Buy the open after a day down 2% or more, exit at the close.
              </p>
            </div>

            <div className="space-y-5">
              <Finding label="What the test found">
                A real edge that survived the held-out window — a Calmar of{" "}
                <b className="font-medium text-foreground">0.79</b> against{" "}
                <b className="font-medium text-foreground">0.52</b> for buying and
                holding the index.
              </Finding>
              <Finding label="Why it was killed anyway">
                It correlated with a strategy already in the book. Adding it would
                have doubled risk the portfolio was carrying rather than
                diversifying it.
              </Finding>
              <Link
                href="/kill-log"
                className="group inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Read the full write-up
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  &rarr;
                </span>
              </Link>
            </div>
          </div>
        </article>
      </Reveal>
    </Section>
  );
}

function Finding({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-l border-border pl-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-foreground/85">
        {children}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- shared -- */

function Section({
  children,
  last = false,
}: {
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section
      className={[
        "border-t border-border py-16 sm:py-20",
        last ? "" : "",
      ].join(" ")}
    >
      {children}
    </section>
  );
}

const fmtInt = (n: number) => n.toLocaleString("en-US");
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const pct = (n: number) => `${n.toFixed(n >= 100 ? 0 : 1)}%`;
