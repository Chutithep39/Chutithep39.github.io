import data from "@/data/portfolio99.json";
import { LEGS, hueOf, letterOf, marketOf } from "@/lib/legs";

/*  How independent the eight strategies actually are, measured rather than
 *  asserted. The claim on this page is that they can share one balance; this
 *  is the evidence for it, and it is the first thing that would betray the
 *  claim if it were false.
 */

const C = data.correlation as {
  basis: string;
  matrix: (number | null)[][];
  matrix_dd: (number | null)[][];
  n_days: number;
  n_days_dd: number;
  mean: number;
  max: number;
  dd_mean: number;
  dd_max: number;
  dd_quantile_pct: number;
};

/*  Scaled over ±0.4, not ±1. Every off-diagonal pair here sits inside that
    band, and a ±1 ramp would wash all of them to the same empty grey — the
    one pair that IS related would stop looking related.                    */
const tint = (v: number) => {
  const a = Math.min(Math.abs(v) / 0.4, 1) * 0.55;
  return v >= 0
    ? `rgba(255, 90, 101, ${a})`   // moves together
    : `rgba(0, 194, 255, ${a})`;   // moves against
};

export function CorrelationMatrix() {
  const n = LEGS.length;

  return (
    <section data-tour="matrix">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
        Correlation between the strategies
      </h2>

      {/*  A correlation matrix is symmetric, so half of it is wasted ink.
          The spare half carries the measurement that actually decides the
          question: the same pairs, over the days the book was losing.     */}
      <p className="mt-1 text-[12px] text-muted-foreground">
        Upper half: all {C.n_days.toLocaleString("en-US")} days. Lower half:
        the worst {C.dd_quantile_pct}% of them (
        {C.n_days_dd.toLocaleString("en-US")} days), which is the half that
        decides whether these can share one balance.
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card p-4">
        <table className="w-full min-w-[520px] border-separate border-spacing-1 font-mono text-[11px] tabular-nums">
          <thead>
            <tr>
              <th className="w-24" />
              {LEGS.map((leg, i) => (
                <th
                  key={i}
                  scope="col"
                  className="px-1 pb-1 text-center font-normal"
                  style={{ color: hueOf(i) }}
                >
                  {letterOf(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LEGS.map((leg, r) => (
              <tr key={r}>
                <th
                  scope="row"
                  className="whitespace-nowrap pr-2 text-right font-normal text-muted-foreground"
                >
                  <span style={{ color: hueOf(r) }}>{letterOf(r)}</span>{" "}
                  {marketOf(leg)}
                </th>
                {Array.from({ length: n }, (_, c) => {
                  //  The diagonal is 1 by construction and carries no
                  //  information; colouring it would be the loudest thing in
                  //  a table whose whole point is that nothing is loud.
                  const self = r === c;
                  const drawdown = r > c;
                  const v = (drawdown ? C.matrix_dd : C.matrix)[r]?.[c];
                  return (
                    <td
                      key={c}
                      title={
                        self
                          ? undefined
                          : `${letterOf(r)} vs ${letterOf(c)} — ${
                              drawdown
                                ? `worst ${C.dd_quantile_pct}% of days`
                                : "all days"
                            }`
                      }
                      className={[
                        "rounded px-1 py-1.5 text-center",
                        self ? "text-muted-foreground/50" : "text-foreground",
                        //  The two halves are different measurements, and a
                        //  reader scanning the grid has to be able to tell
                        //  which one a cell belongs to without counting rows.
                        drawdown ? "italic" : "",
                      ].join(" ")}
                      style={{
                        background: self
                          ? "rgba(0, 0, 0, 0.45)"
                          : v == null
                            ? "transparent"
                            : tint(v),
                      }}
                    >
                      {self ? "—" : v == null ? "" : v.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 max-w-3xl text-[12px] leading-relaxed text-muted-foreground">
        Pearson correlation of the pair&rsquo;s daily P&amp;L, so it reads
        shape rather than size. Upper half: all{" "}
        {C.n_days.toLocaleString("en-US")} days. Lower half: the{" "}
        {C.n_days_dd.toLocaleString("en-US")} worst.{" "}
        <span style={{ color: "#ff8a92" }}>Positive</span> = they lose on the
        same days, <span style={{ color: "#5ad4ff" }}>negative</span> = one
        cushions the other.
      </p>

    </section>
  );
}
