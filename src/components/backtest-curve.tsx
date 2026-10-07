import data from "@/data/backtest.json";

/*  The rule, traded. Cumulative net return, one step per trade.
 *
 *  Trade-indexed rather than date-indexed on purpose: this fires about fifteen
 *  times a year, and a date axis would spend most of its width drawing the
 *  flat stretches where nothing happened. What a reader wants to see is the
 *  sequence of outcomes, and whether the held-out half looks like the fitted
 *  one.
 *
 *  Fixed size — returns added, not compounded — so the line is the edge and
 *  not the order the good years arrived in.
 */

type Win = {
  label: string;
  from: string;
  to: string;
  years: number;
  n_trades: number;
  gross_mean_pct: number;
  cost_mean_pct: number;
  net_mean_pct: number;
  win_rate_pct: number;
  total_pct: number;
  per_year_pct: number;
  max_dd_pct: number;
  sharpe: number | null;
};

const D = data as {
  symbol: string;
  threshold_pct: number;
  split: string;
  windows: Win[];
  curve: { d: string | null; v: number }[];
};

const W = 900;
const H = 330;
const PAD = { t: 26, r: 120, b: 22, l: 54 };
const r2 = (n: number) => Math.round(n * 100) / 100;

const FITTED = "var(--chart-2)";
const HELD = "var(--chart-1)";

export function BacktestCurve() {
  const pts = D.curve;
  const splitAt = pts.findIndex((p) => p.d !== null && p.d >= D.split);
  const vs = pts.map((p) => p.v);
  const y0 = Math.min(...vs, 100);
  const y1 = Math.max(...vs);

  const x = (i: number) => r2(PAD.l + (i / (pts.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) =>
    r2(PAD.t + (1 - (v - y0) / Math.max(y1 - y0, 1)) * (H - PAD.t - PAD.b));

  const path = (from: number, to: number) =>
    pts
      .slice(from, to)
      .map((p, k) => `${k ? "L" : "M"}${x(from + k)},${y(p.v)}`)
      .join(" ");

  //  Round-money gridlines on a 1-2-5 ladder; the axis is a percentage of the
  //  starting unit, so 100 is "no profit yet".
  const span = Math.max(y1 - y0, 1);
  const mag = 10 ** Math.floor(Math.log10(span / 3));
  const raw = span / 3 / mag;
  const step = (raw >= 5 ? 5 : raw >= 2 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) ticks.push(v);

  const last = pts[pts.length - 1];
  const split = pts[splitAt];

  return (
    <figure className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-medium">
          {D.symbol} — cumulative return, net of spread, one unit per trade
        </span>
        <span className="shrink-0 font-mono text-[12px] text-muted-foreground">
          {pts.length - 1} trades
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Cumulative net return of the strategy, fitted and held-out halves"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--border)"
                strokeOpacity={0.35}
              />
              <text
                x={PAD.l - 10}
                y={y(t) + 4}
                textAnchor="end"
                className="font-mono"
                fontSize="12"
                fill="var(--muted-foreground)"
              >
                {t === 100 ? "0%" : `+${Math.round(t - 100)}%`}
              </text>
            </g>
          ))}

          {/*  Where the fitting stopped. Everything right of this line was
              scored once, after the rule was fixed.                      */}
          {splitAt > 0 && (
            <>
              <line
                x1={x(splitAt)}
                x2={x(splitAt)}
                y1={PAD.t}
                y2={H - PAD.b}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.5}
                strokeDasharray="3 4"
              />
              <text
                x={x(splitAt) + 8}
                y={PAD.t + 2}
                className="font-mono"
                fontSize="12"
                fill="var(--muted-foreground)"
              >
                held out from {D.split.slice(0, 4)}
              </text>
            </>
          )}

          <path
            className="draw-line"
            d={path(0, splitAt + 1)}
            fill="none"
            stroke={FITTED}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <path
            className="draw-line flare"
            style={{ animationDelay: "900ms", color: HELD }}
            d={path(splitAt, pts.length)}
            fill="none"
            stroke={HELD}
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {split && (
            <circle cx={x(splitAt)} cy={y(split.v)} r={3.5} fill={FITTED} />
          )}
          <circle
            className="fade-late"
            style={{ animationDelay: "2.2s" }}
            cx={x(pts.length - 1)}
            cy={y(last.v)}
            r={3.5}
            fill={HELD}
          />
          <text
            x={x(pts.length - 1) + 10}
            y={y(last.v) + 4}
            style={{ animationDelay: "2.2s", color: HELD }}
            className="fade-late flare font-mono"
            fontSize="13"
            fontWeight={700}
            fill={HELD}
          >
            +{Math.round(last.v - 100)}%
          </text>

        </svg>
      </div>
    </figure>
  );
}

export function BacktestTable() {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[720px] font-mono text-[12px] tabular-nums">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {[
              "Window",
              "Trades",
              "Gross / trade",
              "Cost / trade",
              "Net / trade",
              "Win rate",
              "Total",
              "Max DD",
              "Sharpe",
            ].map((h, i) => (
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
          {D.windows.map((w, i) => (
            <tr
              key={w.label}
              className={[
                i > 0 ? "border-t border-border/50" : "",
                //  The held-out row is the one that decides anything.
                w.label === "Held out"
                  ? "text-foreground flare"
                  : "text-muted-foreground",
              ].join(" ")}
            >
              <th scope="row" className="whitespace-nowrap px-4 py-2.5 text-left font-normal">
                {w.label}
                <span className="ml-2 opacity-60">
                  {w.from.slice(0, 4)}–{w.to.slice(0, 4)}
                </span>
              </th>
              <td className="px-4 py-2.5 text-right">{w.n_trades}</td>
              <td className="px-4 py-2.5 text-right">
                +{w.gross_mean_pct.toFixed(3)}%
              </td>
              <td className="px-4 py-2.5 text-right">
                −{w.cost_mean_pct.toFixed(3)}%
              </td>
              <td className="px-4 py-2.5 text-right">
                +{w.net_mean_pct.toFixed(3)}%
              </td>
              <td className="px-4 py-2.5 text-right">{w.win_rate_pct}%</td>
              <td className="px-4 py-2.5 text-right">+{w.total_pct}%</td>
              <td className="px-4 py-2.5 text-right">{w.max_dd_pct}%</td>
              <td className="px-4 py-2.5 text-right">{w.sharpe ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
