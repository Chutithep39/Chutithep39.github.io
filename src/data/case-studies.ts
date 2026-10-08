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
      { label: "Instrument", value: "USTEC — NASDAQ 100" },
      { label: "Window", value: "2018 → 2026, one-minute data" },
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
              "NASDAQ, fitted years only. Today's open-to-close return on the X-axis, the next day's average return on the Y-axis. Everything after 2023 is held back for the backtest.",
          },
          { kind: "figure", id: "baseline-histogram" },
          {
            kind: "p",
            text:
              "Days that move more than 4% in either direction tend to revert: a fall of 4% or more is followed by +1.73%, a rise of 4% or more by −0.99%. That is the overshoot the hypothesis claims, and it shows up on both sides rather than only the one the claim needed — which is the stronger result, because a mechanism about forced flow should not care which way the flow runs.",
          },
          {
            kind: "p",
            text:
              "Two cautions sit against it. The middle of the chart barely moves — the seven buckets between −3% and +4% sit close to an ordinary day — so most of the shape rests on 33 of 1,548 days. And a reversal measured on 33 days could as easily be a few crash weeks as an effect.",
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
              "Only the deep falls do anything. After a fall of 2% or more the next day averages +0.44% against +0.05%, at 98% confidence; 2.5% is similar. At 1.0% and 1.5% the difference does not reach significance at all.",
              "The direction shows nothing. After a 2% fall the next day closes green 55.4% of the time against 55.6% otherwise — no difference at all. So the strategy does not win more often than any other day, but when it wins, it wins bigger.",
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
              "If yesterday fell more than 2%, buy today's open at 01:00 and sell at 22:00.",
          },
          {
            kind: "p",
            text:
              "2% is the strongest threshold that still has a usable sample — p = 0.020 on 121 events, against 74 at 2.5%. It was picked off the table above, which sees only the fitted years, so the held-out half below really is held out.",
          },
          { kind: "figure", id: "backtest-curve" },
          { kind: "figure", id: "backtest-table" },
          {
            kind: "p",
            text:
              "It works in sample and out: +0.48% a trade fitted, +0.43% held out. In total, +61.8% over eight and a half years against a 9.3% maximum drawdown, on 132 trades.",
          },
          {
            kind: "p",
            text:
              "The strategy has a Calmar ratio of 0.79, which beats buy and hold on the NASDAQ at 0.52.",
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
              "The dip buy correlates with Strategy A and Strategy H, both of which trade the NASDAQ. Against H it runs at +0.42 on all days and +0.34 on the book's worst ones.",
          },
          {
            kind: "p",
            text:
              "That is where it dies. H covers the same ground at a Calmar of 1.75 against 0.79 here, so the slot is already filled by the better of the two.",
          },
        ],
      },
    ],
  },
];
