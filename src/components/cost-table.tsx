import { LEGS, hueOf, letterOf, marketOf } from "@/lib/legs";

/*  What the curve paid to exist.
 *
 *  A backtest that forgets costs is the easiest way to draw a line like the one
 *  above, so the arithmetic is on the page rather than asserted in a sentence:
 *  gross, what the broker took, and the net that is actually plotted.
 */

const money = (v: number) =>
  (v < 0 ? "-$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US");

export function CostTable() {
  const rows = LEGS.map((leg, i) => ({ leg, i, c: leg.cost }));
  const total = rows.reduce(
    (a, r) => ({
      gross: a.gross + (r.c?.gross ?? 0),
      commission: a.commission + (r.c?.commission ?? 0),
      swap: a.swap + (r.c?.swap ?? 0),
      net: a.net + (r.c?.net ?? 0),
      n: a.n + (r.c?.n_trades ?? 0),
    }),
    { gross: 0, commission: 0, swap: 0, net: 0, n: 0 },
  );
  const bite = (c: number, g: number) => (g > 0 ? (c / g) * 100 : 0);

  return (
    <section data-tour="cost">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
        What the strategies paid to trade
      </h2>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Every figure on this page is the net column. Dollars are on the same
        fixed-size $10k basis as the chart.
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card p-4">
        <table className="w-full min-w-[640px] font-mono text-[12px] tabular-nums">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th scope="col" className="pb-2 text-left font-normal">Strategy</th>
              <th scope="col" className="pb-2 text-right font-normal">Trades</th>
              <th scope="col" className="pb-2 text-right font-normal">Gross</th>
              <th scope="col" className="pb-2 text-right font-normal">Commission</th>
              <th scope="col" className="pb-2 text-right font-normal">Swap</th>
              <th scope="col" className="pb-2 text-right font-normal">Net</th>
              <th scope="col" className="pb-2 text-right font-normal">Cost bite</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ leg, i, c }) => (
              <tr key={i} className="border-t border-border/60">
                <th scope="row" className="whitespace-nowrap py-2 text-left font-normal">
                  <span style={{ color: hueOf(i) }}>{letterOf(i)}</span>{" "}
                  <span className="text-muted-foreground">{marketOf(leg)}</span>
                </th>
                <td className="py-2 text-right text-muted-foreground">
                  {c ? c.n_trades.toLocaleString("en-US") : "—"}
                </td>
                <td className="py-2 text-right">{c ? money(c.gross) : "—"}</td>
                <td className="py-2 text-right text-muted-foreground">
                  {/*  A zero here is the broker's pricing, not a gap in the
                      model — the footnote says which symbols are free.    */}
                  {c ? (c.commission ? `-${money(c.commission)}` : "$0") : "—"}
                </td>
                <td className="py-2 text-right text-muted-foreground">
                  {c ? (c.swap ? `-${money(c.swap)}` : "$0") : "—"}
                </td>
                <td className="py-2 text-right text-foreground">
                  {c ? money(c.net) : "—"}
                </td>
                <td className="py-2 text-right text-muted-foreground">
                  {c ? `${bite(c.commission + c.swap, c.gross).toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
            <tr className="border-t border-border font-medium">
              <th scope="row" className="py-2 text-left">Book</th>
              <td className="py-2 text-right text-muted-foreground">
                {total.n.toLocaleString("en-US")}
              </td>
              <td className="py-2 text-right">{money(total.gross)}</td>
              <td className="py-2 text-right">-{money(total.commission)}</td>
              <td className="py-2 text-right">-{money(total.swap)}</td>
              <td className="py-2 text-right">{money(total.net)}</td>
              <td className="py-2 text-right">
                {bite(total.commission + total.swap, total.gross).toFixed(1)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 max-w-3xl text-[12px] leading-relaxed text-muted-foreground">
        Commission is{" "}
        <span className="font-mono text-foreground">$3.50</span> per lot per
        side — Gold and USDJPY only; the index and Bitcoin CFDs are
        commission-free here. Swap is the overnight financing on a position
        held past rollover, near zero because these close the same day. Spread
        is inside gross: fills already cross the bid/ask recorded on each bar.
      </p>

    </section>
  );
}
