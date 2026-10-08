/*  One research write-up, taken from the vault the work actually lives in.
 *
 *  It is a KILL, deliberately. A live edge published is a live edge shared; a
 *  dead one costs nothing to show and demonstrates the same thing — what was
 *  claimed, what would have falsified it, what the data said, and what the
 *  test still could not settle.
 *
 *  It is also the most useful kind of kill to read: the effect is real and
 *  statistically significant, and it was thrown away anyway. A write-up where
 *  the idea simply did not work shows nothing about judgement.
 */

/*  EVERY QUOTED FIGURE IS READ OUT OF THE EXPORTS, NOT TYPED HERE.
 *
 *  This file used to carry the numbers as literals — "p = 0.020 on 121
 *  events", "+61.8% over eight and a half years", "Calmar 0.79 against 0.52".
 *  All of those are outputs of the nightly refresh. Left as prose they would
 *  go on asserting last month's result next to a chart drawn from today's,
 *  which is the one failure a page about checkable work cannot afford.
 *
 *  The sentences are still written by hand. Only the numbers inside them come
 *  from the data, so the prose can stay prose and still never drift.
 */
import backtest from "@/data/backtest.json";
import baseline from "@/data/baseline.json";
import candidate from "@/data/candidate-correlation.json";
import dipSweep from "@/data/dip-sweep.json";
import { LEGS, letterOf, marketOf } from "@/lib/legs";
import { spokenDuration } from "@/lib/facts";

const SYM = backtest.symbol as string;
const THR = backtest.threshold_pct as number;          // e.g. -2
const THR_PCT = `${Math.abs(THR)}%`;
const EXIT = `${String(backtest.exit_hour).padStart(2, "0")}:00`;
const ENTRY = `${String(backtest.entry_hour).padStart(2, "0")}:00`;

type Win = {
  label: string; from: string; to: string; years: number; n_trades: number;
  net_mean_pct: number; total_pct: number; per_year_pct: number;
  max_dd_pct: number; win_rate_pct: number;
};
const WINS = backtest.windows as Win[];
const pick = (label: string) => WINS.find((w) => w.label === label)!;
const FIT = pick("Fitted");
const OOS = pick("Held out");
const ALL = pick("Full period");
const CALMAR = ALL.per_year_pct / ALL.max_dd_pct;
const HOLD = backtest.buy_and_hold as { label: string; calmar: number | null };

/*  The analysis section reads the symbol the hypothesis was framed on. */
const B = (baseline.symbols as Record<string, {
  conditional: {
    unconditional_mean_pct: number;
    n_pairs: number;
    bins: { lo: number | null; hi: number | null; n: number; mean_pct: number }[];
  };
  significance: {
    threshold: number; n_after: number; p_mean: number;
    mean_after_pct: number; mean_other_pct: number;
    up_after_pct: number; up_other_pct: number;
  }[];
}>)[SYM];

const BINS = B.conditional.bins;
const DOWN_TAIL = BINS[0];                      // everything below the lowest edge
const UP_TAIL = BINS[BINS.length - 1];
const TAIL_EDGE = `${Math.abs(DOWN_TAIL.hi ?? 4)}%`;
const TAIL_N = DOWN_TAIL.n + UP_TAIL.n;
//  The quiet middle: every bucket inside the two tails.
const MIDDLE_N = BINS.length - 2;
const MIDDLE_LO = `${Math.abs(BINS[1].hi ?? 3)}%`;
const MIDDLE_HI = `+${UP_TAIL.lo ?? 4}%`;

const sig = (t: number) => B.significance.find((r) => r.threshold === t)!;
const SIG = sig(THR);
const SIG_NEXT = B.significance.find((r) => r.threshold < THR);
const CONF = `${Math.round((1 - SIG.p_mean) * 100)}%`;

const DIP = dipSweep.chosen as { is: number; around: number };

/*  Which deployed strategy the candidate collides with, found in the matrix
    rather than named here — if the book changes, so does the sentence.    */
const CAND_I = candidate.candidate_index as number;
const C_ALL = (candidate.matrix as number[][])[CAND_I];
const C_DD = (candidate.matrix_dd as number[][])[CAND_I];
const RIVAL = C_ALL
  .map((v, i) => ({ i, v }))
  .filter((x) => x.i !== CAND_I)
  .sort((a, b) => b.v - a.v)[0];
const RIVAL_NAME = `Strategy ${letterOf(RIVAL.i)}`;
const RIVAL_CALMAR = LEGS[RIVAL.i]?.stats?.calmar ?? null;
const SECOND = C_ALL
  .map((v, i) => ({ i, v }))
  .filter((x) => x.i !== CAND_I && x.i !== RIVAL.i)
  .sort((a, b) => b.v - a.v)[0];

const n1 = (v: number) => v.toFixed(1);
const n2 = (v: number) => v.toFixed(2);
const sgn = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));

export type Table = {
  caption?: string;
  head: string[];
  rows: string[][];
  /** Row indices carrying the finding, marked so the eye lands there first. */
  mark?: number[];
  note?: string;
};

export type Block =
  | { kind: "p"; text: string }
  /** The one sentence a section exists to deliver. */
  | { kind: "lede"; text: string }
  /** Set off from the argument: a quote, or a rule being held to. */
  | { kind: "quote"; text: string; cite?: string }
  | { kind: "list"; items: string[] }
  /** A section that exists in the outline but has no content yet. An honest
      gap beats a heading that quietly disappears until it is finished. */
  | { kind: "placeholder"; text: string }
  /** A named chart. Figures live in their own components because they read
      data the write-up does not carry. */
  | {
      kind: "figure";
      id:
        | "baseline-histogram"
        | "significance-table"
        | "backtest-curve"
        | "backtest-table"
        | "dip-surface"
        | "candidate-correlation";
    }
  /** Every word in the claim that could mean two things, pinned to one. */
  | { kind: "qa"; items: { q: string; a: string }[] }
  | { kind: "table"; table: Table };

export type Part = { title: string; blocks: Block[] };

export type CaseStudy = {
  slug: string;
  title: string;
  /** The claim in one plain sentence, for the reader who stops after it. */
  oneLine: string;
  verdict: string;
  killedBy: string;
  cause: "additivity" | "cost";
  meta: { label: string; value: string }[];
  parts: Part[];
};

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "buy-the-big-down-day",
    title: "Buying the index after a big down day",
    oneLine:
      "When an index falls hard in one day, buy it the next morning and sell it that same evening.",
    verdict: "Killed",
    killedBy:
      "Real and significant, but it fails correlation analysis by doubling the risk already in the portfolio",
    cause: "additivity",
    meta: [
      { label: "Instrument", value: `${SYM} — ${marketOf({ symbol: SYM } as never)}` },
      {
        label: "Window",
        value: `${ALL.from.slice(0, 4)} → ${ALL.to.slice(0, 4)}, one-minute data`,
      },
      { label: "Hold", value: "Next day open → close, no overnight" },
      { label: "Killed on", value: "Side-prediction 3 — the correlation gate" },
    ],
    parts: [
      {
        title: "Formulating the hypothesis",
        blocks: [
          {
            kind: "quote",
            text:
              "When major indices drop more than a set amount on a single day, the next day has a high likelihood to go up.",
            cite: "The original note, before any testing",
          },
          //  The ambiguity in that sentence — gap or no gap — used to be
          //  unpacked here in two paragraphs. It belongs where it is acted on,
          //  in the metrics, not as prose the reader has to hold in their head
          //  until then.
        ],
      },
      {
        title: "Mechanism",
        blocks: [
          {
            kind: "lede",
            text:
              "A large one-day price fall is mostly forced selling or an overreaction to news, and it tends to overshoot.",
          },
        ],
      },
      {
        title: "Defining the metrics",
        blocks: [
          {
            kind: "lede",
            text:
              "The hypothesis as stated is still too vague to test. Every term in it has to be given one definition before any data is touched.",
          },
          {
            kind: "qa",
            items: [
              {
                q: "Which index, over what period?",
                a: "USTEC — the NASDAQ 100 CFD, quoted commission-free at this broker, so spread is the only cost. 2018 to 2026, on one-minute data.",
              },
              {
                q: "What defines a single trading day?",
                a: "The broker's day: 01:00 to 23:59 server time, GMT+2 in winter and GMT+3 in summer.",
              },
              {
                q: "What counts as a big down day?",
                a: "An open-to-close fall of −1.0% to −2.5%, each threshold tested separately.",
              },
              {
                q: "Buy the next day — when exactly?",
                a: "At the next day's open, 01:00 broker — so the overnight gap is never held.",
              },
              {
                q: "And sell when?",
                a: "At 22:00 broker, the daily close.",
              },
              {
                q: "What does a trade cost?",
                a: "Spread only. Index CFDs carry no commission at this broker.",
              },
              {
                q: "What would count as working?",
                a: "The mean return after a big down day must beat the mean on every other day, and the gap must be statistically significant — not merely positive.",
              },
            ],
          },
        ],
      },
      {
        title: "Conducting analysis",
        blocks: [
          {
            kind: "lede",
            text:
              `${marketOf({ symbol: SYM } as never)}, fitted years only. Today's open-to-close return on the X-axis, the next day's average return on the Y-axis. Everything after ${Number(backtest.split.slice(0, 4)) - 1} is held back for the backtest.`,
          },
          { kind: "figure", id: "baseline-histogram" },
          {
            kind: "p",
            text:
              `Days that move more than ${TAIL_EDGE} in either direction tend to revert: a fall of ${TAIL_EDGE} or more is followed by ${sgn(DOWN_TAIL.mean_pct)}%, a rise of ${TAIL_EDGE} or more by ${sgn(UP_TAIL.mean_pct)}%. That is the overshoot the hypothesis claims, and it shows up on both sides rather than only the one the claim needed — which is the stronger result, because a mechanism about forced flow should not care which way the flow runs.`,
          },
          {
            kind: "p",
            text:
              `Two cautions sit against it. The middle of the chart barely moves — the ${MIDDLE_N} buckets between −${MIDDLE_LO} and ${MIDDLE_HI} sit close to an ordinary day — so most of the shape rests on ${TAIL_N} of ${B.conditional.n_pairs.toLocaleString("en-US")} days. And a reversal measured on ${TAIL_N} days could as easily be a few crash weeks as an effect.`,
          },
          {
            kind: "lede",
            text:
              "Each threshold against every other day — one-sided hypothesis testing.",
          },
          { kind: "figure", id: "significance-table" },
          {
            kind: "lede",
            text: "Key takeaways",
          },
          {
            kind: "list",
            items: [
              `Only the deep falls do anything. After a fall of ${THR_PCT} or more the next day averages ${sgn(SIG.mean_after_pct)}% against ${sgn(SIG.mean_other_pct)}%, at ${CONF} confidence; ${Math.abs(SIG_NEXT!.threshold)}% is similar. At the shallower thresholds the difference does not reach significance at all.`,
              `The direction shows nothing. After a ${THR_PCT} fall the next day closes green ${n1(SIG.up_after_pct)}% of the time against ${n1(SIG.up_other_pct)}% otherwise — no difference at all. So the strategy does not win more often than any other day, but when it wins, it wins bigger.`,
            ],
          },
        ],
      },
      {
        title: "Backtesting and robustness test",
        blocks: [
          {
            kind: "lede",
            text:
              `If yesterday fell more than ${THR_PCT}, buy today's open at ${ENTRY} and sell at ${EXIT}.`,
          },
          {
            kind: "p",
            text:
              `${THR_PCT} is the strongest threshold that still has a usable sample — p = ${SIG.p_mean.toFixed(3)} on ${SIG.n_after} events, against ${SIG_NEXT!.n_after} at ${Math.abs(SIG_NEXT!.threshold)}%. It was picked off the table above, which sees only the fitted years, so the held-out half below really is held out.`,
          },
          { kind: "figure", id: "backtest-curve" },
          { kind: "figure", id: "backtest-table" },
          {
            kind: "p",
            text:
              `It works in sample and out: ${sgn(FIT.net_mean_pct)}% a trade fitted, ${sgn(OOS.net_mean_pct)}% held out. In total, +${n1(ALL.total_pct)}% over ${spokenDuration(ALL.years)} against a ${n1(ALL.max_dd_pct)}% maximum drawdown, on ${ALL.n_trades} trades.`,
          },
          {
            kind: "p",
            text:
              `The strategy has a Calmar ratio of ${n2(CALMAR)}, which beats buy and hold on the ${marketOf({ symbol: SYM } as never)} at ${n2(HOLD.calmar ?? 0)}.`,
          },
          {
            kind: "p",
            text:
              "But that backtest trades one threshold at one exit time, and both were chosen. So both were swept.",
          },
          { kind: "figure", id: "dip-surface" },
          {
            kind: "p",
            text:
              `The chosen pair scores ${n2(DIP.is)} on the fitted years and its four neighbours average ${n2(DIP.around)}. It is a shoulder, not a needle — being a quarter of a percent out on the trigger, or an hour early on the exit, changes very little. That is the result holding up, rather than one coordinate getting lucky.`,
          },
        ],
      },
      {
        title: "Correlation analysis",
        blocks: [
          {
            kind: "lede",
            text:
              "A standalone edge is not the question. Whether it adds anything to a book that is already long the same index is.",
          },
          { kind: "figure", id: "candidate-correlation" },
          {
            kind: "p",
            text:
              `The dip buy correlates with ${RIVAL_NAME} and Strategy ${letterOf(SECOND.i)}, both of which trade the ${marketOf({ symbol: SYM } as never)}. Against ${letterOf(RIVAL.i)} it runs at ${sgn(RIVAL.v)} on all days and ${sgn(C_DD[RIVAL.i])} on the book's worst ones.`,
          },
          {
            kind: "p",
            text:
              `That is where it dies. ${letterOf(RIVAL.i)} covers the same ground at a Calmar of ${n2(RIVAL_CALMAR ?? 0)} against ${n2(CALMAR)} here, so the slot is already filled by the better of the two.`,
          },
        ],
      },
    ],
  },
];
