import data from "@/data/candidate-correlation.json";
import { hueOf, letterOf, LEGS, marketOf } from "@/lib/legs";

/*  The candidate against the book it would have to join.
 *
 *  Same construction as the matrix on the results page — Pearson on daily
 *  P&L, all days above the diagonal, the portfolio's worst 20% below it — with
 *  one extra row and column for the rule this write-up tests.
 *
 *  Its own row and column are highlighted, because that is the only line
 *  anyone is reading this table for: the other 28 pairs are context.
 */

const D = data as {
  labels: string[];
  candidate_index: number;
  n_days: number;
  n_days_dd: number;
  dd_quantile_pct: number;
  matrix: (number | null)[][];
  matrix_dd: (number | null)[][];
  candidate_mean: number;
  candidate_max: number;
  candidate_dd_mean: number;
  candidate_dd_max: number;
};

const K = D.candidate_index;
const CAND = "Dip buy";

//  Scaled over ±0.4, not ±1. Every pair here sits inside that band, and a ±1
//  ramp would wash the one related pair out with the rest.
const tint = (v: number) => {
  const a = Math.min(Math.abs(v) / 0.4, 1) * 0.55;
  return v >= 0 ? `rgba(255, 90, 101, ${a})` : `rgba(0, 194, 255, ${a})`;
};

const head = (i: number) => (i === K ? CAND : letterOf(i));
const rowLabel = (i: number) =>
  i === K ? CAND : `${letterOf(i)} ${marketOf(LEGS[i])}`;

export function CandidateCorrelation() {
  const n = D.labels.length;

  return (
    <section className="mt-6">
      <div className="overflow-x-auto rounded-xl border border-border bg-card p-1 sm:p-4">
        {/*  Phone: letters only in the row headers so the grid fits. */}
        <table className="w-full border-separate border-spacing-px font-mono text-[9.5px] tabular-nums sm:min-w-[620px] sm:border-spacing-1 sm:text-[11px]">
          <thead>
            <tr>
              <th className="sm:w-28" />
              {D.labels.map((_, i) => (
                <th
                  key={i}
                  scope="col"
                  className={[
                    "px-0 pb-1 text-center font-normal sm:px-1",
                    i === K ? "text-foreground" : "",
                  ].join(" ")}
                  style={i === K ? undefined : { color: hueOf(i) }}
                >
                  {head(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {D.labels.map((_, r) => (
              <tr key={r}>
                <th
                  scope="row"
                  className={[
                    "whitespace-nowrap pr-1 text-right font-normal sm:pr-2",
                    r === K ? "text-foreground" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {r === K ? (
                    CAND
                  ) : (
                    <>
                      <span style={{ color: hueOf(r) }}>{letterOf(r)}</span>
                      <span className="hidden sm:inline"> {marketOf(LEGS[r])}</span>
                    </>
                  )}
                </th>
                {Array.from({ length: n }, (_, c) => {
                  const self = r === c;
                  const drawdown = r > c;
                  const v = (drawdown ? D.matrix_dd : D.matrix)[r]?.[c];
                  const mine = r === K || c === K;
                  return (
                    <td
                      key={c}
                      title={
                        self
                          ? undefined
                          : `${rowLabel(r)} vs ${rowLabel(c)} — ${
                              drawdown
                                ? `worst ${D.dd_quantile_pct}% of days`
                                : "all days"
                            }`
                      }
                      className={[
                        "rounded px-0 py-1.5 text-center sm:px-1",
                        //  The pair that kills the candidate. Pulsed once, on
                        //  arrival, because a reader scanning an 81-cell grid
                        //  has no way to know which two cells the paragraph
                        //  underneath is about.
                        mine && v != null && Math.abs(v) >= 0.3
                          ? "pulse flare"
                          : "",
                        self
                          ? "text-muted-foreground/50"
                          : mine
                            ? "text-foreground"
                            : "text-muted-foreground/70",
                        drawdown ? "italic" : "",
                      ].join(" ")}
                      style={{
                        background: self
                          ? "rgba(0, 0, 0, 0.45)"
                          : v == null
                            ? "transparent"
                            : tint(v),
                        //  The candidate's own row and column are the subject;
                        //  everything else is there to be compared against.
                        opacity: self || mine ? 1 : 0.45,
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

      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
        Pearson correlation of daily P&amp;L. Upper half: all{" "}
        {D.n_days.toLocaleString("en-US")} days. Lower half: the{" "}
        {D.n_days_dd.toLocaleString("en-US")} worst days for the existing book.{" "}
        <span style={{ color: "#ff8a92" }}>Positive</span> = they lose on the
        same days, <span style={{ color: "#5ad4ff" }}>negative</span> = one
        cushions the other.
      </p>
    </section>
  );
}
