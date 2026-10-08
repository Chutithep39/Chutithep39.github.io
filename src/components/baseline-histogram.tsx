import data from "@/data/baseline.json";

/*  The hypothesis, drawn directly: today's move on the category axis, the
 *  average return of the NEXT day as the bar.
 *
 *  Stripped to the shape the owner sketched — no value axis, no gridlines, no
 *  reference annotation. Each bar carries its own number, so a ruler down the
 *  side would only be asking the reader to measure something already written.
 *  Blue above zero, red below, and the two axis titles sit at the ends of the
 *  axes they name rather than in a legend.
 */

type Bin = {
  /** null = unbounded on that side. */
  lo: number | null;
  hi: number | null;
  n: number;
  mean_pct: number;
  se_pct: number;
  t_vs_uncond: number;
};

const D = data as {
  symbols: Record<
    string,
    {
      from: string;
      to: string;
      conditional: {
        unconditional_mean_pct: number;
        n_pairs: number;
        bins: Bin[];
      };
    }
  >;
};

const SYM = "USTEC";
const LABEL = "NASDAQ";
const S = D.symbols[SYM];
const C = S.conditional;

const W = 900;
const H = 420;
const PAD = { t: 40, r: 30, b: 72, l: 30 };
const r2 = (n: number) => Math.round(n * 100) / 100;

//  "-5% to -4%" reads as a range; "<= -4%" reads as what the end buckets
//  actually are, now that they carry every day beyond them.
const bucketLabel = (b: Bin) =>
  b.lo === null
    ? `≤ ${b.hi}%`
    : b.hi === null
      ? `≥ +${b.lo}%`
      : `${b.lo}% to ${b.hi}%`;

const UP = "var(--chart-2)";
const DOWN = "var(--chart-4)";

export function BaselineHistogram() {
  const bins = C.bins;
  const top = Math.max(...bins.map((b) => b.mean_pct), 0);
  const bot = Math.min(...bins.map((b) => b.mean_pct), 0);
  //  Headroom for the data labels, which sit outside the bar they belong to.
  const hi = top * 1.18;
  const lo = bot * 1.3;

  const y = (v: number) =>
    r2(PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b));
  const zero = y(0);
  const slot = (W - PAD.l - PAD.r) / bins.length;
  const barW = r2(slot * 0.62);
  const cx = (i: number) => r2(PAD.l + slot * (i + 0.5));

  return (
    <figure className="mt-6">
      {/*  No chart title. It restated the section's opening line word for
          word, and two headings saying the same thing read as a mistake.
          The sample size stays — it is the one fact the lede does not
          carry.                                                           */}
      <div className="flex justify-end">
        <span className="font-mono text-[12px] text-muted-foreground">
          {C.n_pairs.toLocaleString("en-US")} day pairs
        </span>
      </div>

      <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Average next-day return for ${LABEL}, by today's return`}
        >
          <text
            x={PAD.l}
            y={PAD.t - 16}
            className="font-mono"
            fontSize="13"
            fontWeight={700}
            fill="var(--muted-foreground)"
          >
            Next day&rsquo;s return
          </text>

          {bins.map((b, i) => {
            const up = b.mean_pct >= 0;
            //  The open-ended ends — the only two buckets that move, and the
            //  reason the chart is on the page at all.
            const tail = i === 0 || i === bins.length - 1;
            const hgt = r2(Math.abs(y(b.mean_pct) - zero));
            return (
              <g key={bucketLabel(b)}>
                <rect
                  className={[up ? "grow-up" : "grow-down", tail ? "flare" : ""]
                    .join(" ")
                    .trim()}
                  style={{ animationDelay: `${i * 55}ms`, color: up ? UP : DOWN }}
                  x={r2(cx(i) - barW / 2)}
                  y={up ? y(b.mean_pct) : zero}
                  width={barW}
                  height={Math.max(hgt, 1.5)}
                  fill={up ? UP : DOWN}
                />
                <text
                  x={cx(i)}
                  y={up ? r2(y(b.mean_pct) - 8) : r2(y(b.mean_pct) + 17)}
                  textAnchor="middle"
                  className={["fade-late font-mono", tail ? "flare" : ""]
                    .join(" ")
                    .trim()}
                  fontSize={tail ? "15" : "13"}
                  fontWeight={tail ? 700 : 400}
                  fill={up ? UP : DOWN}
                  style={{ color: up ? UP : DOWN }}
                >
                  {b.mean_pct >= 0 ? "" : "−"}
                  {Math.abs(b.mean_pct).toFixed(2)}%
                </text>
                {/*  Category labels sit in ONE row at the bottom, clear of
                    everything. Hung off the zero line they collided with the
                    negative bars and with their own data labels.         */}
                <text
                  x={cx(i)}
                  y={H - PAD.b + 22}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize="12"
                  fill="var(--muted-foreground)"
                >
                  {bucketLabel(b)}
                </text>
              </g>
            );
          })}

          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={zero}
            y2={zero}
            stroke="var(--border)"
          />

          {/*  Where today turns from red to green. The two halves of this
              chart are the two halves of the claim, and without a divider the
              reader has to find the boundary by reading labels.          */}
          <line
            x1={r2(PAD.l + slot * 5)}
            x2={r2(PAD.l + slot * 5)}
            y1={PAD.t - 6}
            y2={H - PAD.b + 6}
            stroke="var(--border)"
            strokeOpacity={0.7}
            strokeDasharray="3 4"
          />

          <text
            x={W - PAD.r}
            y={H - PAD.b + 44}
            textAnchor="end"
            className="font-mono"
            fontSize="13"
            fontWeight={700}
            fill="var(--muted-foreground)"
          >
            Today&rsquo;s return (%)
          </text>
        </svg>
      </div>

    </figure>
  );
}

/*  The claim put to a test, at each threshold the study uses.
 *
 *  Two tests, not one. A Welch t on the next day's MEAN asks whether the
 *  bounce is big; a two-proportion z on its HIT RATE asks whether it is
 *  frequent. They disagree here, and reporting only the one that passes would
 *  be choosing the test after seeing the answer.
 */
type Test = {
  threshold: number;
  n_after: number;
  mean_after_pct: number;
  mean_other_pct: number;
  t: number;
  p_mean: number;
  up_after_pct: number;
  up_other_pct: number;
  p_hit: number;
};

const TESTS = (
  data as unknown as { symbols: Record<string, { significance: Test[] }> }
).symbols[SYM].significance;

const pLabel = (p: number) => (p < 0.001 ? "<0.001" : p.toFixed(3));

export function SignificanceTable() {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[640px] font-mono text-[12px] tabular-nums">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            <th scope="col" className="border-b border-border px-4 py-3 text-left font-normal">
              After a fall of
            </th>
            <th scope="col" className="border-b border-border px-4 py-3 text-right font-normal">
              Days
            </th>
            <th scope="col" className="border-b border-border px-4 py-3 text-right font-normal">
              Next day, mean
            </th>
            <th scope="col" className="border-b border-border px-4 py-3 text-right font-normal">
              Every other day
            </th>
            <th scope="col" className="border-b border-border px-4 py-3 text-right font-normal">
              p, mean
            </th>
            <th scope="col" className="border-b border-border px-4 py-3 text-right font-normal">
              Up rate
            </th>
            <th scope="col" className="border-b border-border px-4 py-3 text-right font-normal">
              p, up rate
            </th>
          </tr>
        </thead>
        <tbody>
          {TESTS.map((t, i) => {
            //  The study's own headline threshold. Marking it is honest only
            //  because the rows around it are all here to be compared with.
            const lead = t.threshold === -2;
            return (
              <tr
                key={t.threshold}
                className={[
                  i > 0 ? "border-t border-border/50" : "",
                  lead ? "text-foreground flare" : "text-muted-foreground",
                ].join(" ")}
              >
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  ≤ {t.threshold.toFixed(1)}%
                </th>
                <td className="px-4 py-2.5 text-right">{t.n_after}</td>
                <td className="px-4 py-2.5 text-right">
                  +{t.mean_after_pct.toFixed(2)}%
                </td>
                <td className="px-4 py-2.5 text-right">
                  +{t.mean_other_pct.toFixed(2)}%
                </td>
                <td
                  className={[
                    "px-4 py-2.5 text-right",
                    t.p_mean < 0.05 ? "text-[#05c168]" : "",
                  ].join(" ")}
                >
                  {pLabel(t.p_mean)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {t.up_after_pct}% vs {t.up_other_pct}%
                </td>
                <td
                  className={[
                    "px-4 py-2.5 text-right",
                    t.p_hit < 0.05 ? "text-[#05c168]" : "",
                  ].join(" ")}
                >
                  {pLabel(t.p_hit)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/*  The alternative is stated on the figure, not left to the reader to
          infer from a p-value. A one-sided test is only legitimate because
          the direction was fixed in the hypothesis beforehand.          */}
      <p className="border-t border-border px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
        One-sided Welch t on the mean and two-proportion z on the up rate.
        H₀: the day after the fall is no better than every other day.
        H₁: it is better.
      </p>
    </div>
  );
}
