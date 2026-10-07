import data from "@/data/portfolio99.json";

/*  What the book is MADE OF, before any of its numbers.
 *
 *  A reader meeting an equity curve first asks what produced it. The honest
 *  answer is a list: which behaviour, on which instrument, at what weight —
 *  and how independent those legs actually are, measured rather than claimed.
 */

type Leg = { symbol: string; family: string; scale: number; n_trades: number };

/*  Internal shorthand is not the reader's vocabulary. The lab calls it `RBO`;
 *  someone reading this has never seen that string before.  */
const FAMILY: Record<string, string> = {
  RBO: "Range breakout",
  "Go Long": "Session long",
  "Orderly Dip": "Orderly dip",
  "Weak Close": "Weak close",
};
const MARKET: Record<string, string> = {
  USTEC: "US tech 100",
  DE40: "Germany 40",
  XAUUSD: "Gold",
  USDJPY: "USD / JPY",
  BTCUSD: "Bitcoin",
};

const LEGS = data.legs as Leg[];
const C = data.correlation;

export function PortfolioComposition() {
  const markets = [...new Set(LEGS.map((l) => l.symbol))];
  const families = [...new Set(LEGS.map((l) => l.family))];

  return (
    <section className="rounded-xl border border-border bg-card/40 p-5">
      <h2 className="text-sm font-medium">
        {LEGS.length} strategies · {families.length} behaviours ·{" "}
        {markets.length} instruments
      </h2>
      <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
        Each leg is a separate hypothesis with its own entry, exit and market —
        they are combined, not blended. Mean pairwise correlation of their daily
        P&amp;L is{" "}
        <span className="font-mono text-foreground">{C.mean.toFixed(2)}</span>,
        and on the worst {C.dd_quantile_pct}% of the portfolio&rsquo;s days it
        is{" "}
        <span className="font-mono text-foreground">
          {C.dd_mean.toFixed(2)}
        </span>{" "}
        — the legs do not bleed together when it matters, which is the only
        reason eight of them can share one balance.
      </p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {LEGS.map((l) => (
          <li
            key={`${l.symbol}-${l.family}`}
            className="flex items-baseline justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2"
          >
            <span className="text-[13px]">
              <span className="text-foreground">
                {FAMILY[l.family] ?? l.family}
              </span>{" "}
              <span className="text-muted-foreground">on</span>{" "}
              <span className="text-foreground">
                {MARKET[l.symbol] ?? l.symbol}
              </span>
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {l.n_trades.toLocaleString("en-US")} trades
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
