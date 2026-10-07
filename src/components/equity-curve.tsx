"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import data from "@/data/portfolio99.json";
import {
  LEGS,
  hueOf,
  legName,
  letterOf,
  type Stats,
} from "@/lib/legs";

/*  The Results chart, in two readings of one book.
 *
 *  COMBINED is the book as it would have been traded: one balance, every
 *  strategy on it, coloured by the window the days fall in.
 *  BY STRATEGY splits that same balance into the eight contributions that make
 *  it up. Each leg is a strategy's own scaled P&L, so the eight add back to
 *  the combined curve exactly — these are shares of one account, not eight
 *  separate accounts.
 *
 *  Both readings start every visible selection at the same capital. Static
 *  sizing is what licenses that: a trade is sized off the opening balance, so
 *  a window's or a leg's P&L does not depend on what came before it.
 */

type Band = {
  key: string;
  label: string;
  from: string;
  to: string;
  stats: Stats;
};

const BANDS = data.bands as Band[];
/*  Always on screen. "Versus just owning the index?" is the first question any
    equity curve has to answer, so the answer is drawn beside it rather than
    left for the reader to go and look up.                                  */
const BENCH = data.benchmark as {
  symbol: string;
  label: string;
  rel: number[];
  stats: Stats;
  by: Record<string, Stats>;
} | null;
const BENCH_HUE = "var(--muted-foreground)";
const START = data.start_balance;
const EPOCH = Date.UTC(2018, 0, 1);
const DAY = 86400000;

/*  One hue per window, from the Strategy Lab chart palette. Identity is the
    WINDOW, not the rank, so these never get reassigned when one is hidden.  */
const HUE: Record<string, string> = {
  is: "var(--chart-2)", // cyan   — the fitted window
  oos: "var(--chart-1)", // magenta — held out
  recent: "var(--chart-3)", // green  — most recent
};

const dayToDate = (d: number) => new Date(EPOCH + d * DAY);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/*  Hand-rolled rather than toLocaleDateString: the broker day is a UTC-stamped
    integer and a locale format would read differently in two places.        */
const fmtDay = (d: number) => {
  const t = dayToDate(d);
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
};
/*  A day's P&L as a share of the STARTING capital, not of that day's balance.
    Fixed sizing is what makes that the right denominator: the position taken on
    any day is sized off the opening balance, so two days that risked the same
    money read the same here no matter how far the account has run.           */
const fmtPct = (v: number) =>
  (v >= 0 ? "+" : "-") + Math.abs(v).toFixed(2) + "%";
const fmtExact = (v: number) =>
  "$" + Math.round(v).toLocaleString("en-US");
//  Axis labels. $250,000 spelled out eats the left gutter at every tick.
const fmtTick = (v: number) =>
  v >= 1000 ? "$" + Math.round(v / 1000).toLocaleString("en-US") + "k"
            : "$" + Math.round(v);

const dayOf = (iso: string) => Math.round((Date.parse(iso) - EPOCH) / DAY);

type Mode = "combined" | "legs";
type Pt = [number, number];
/** A drawn line: its identity, its colour, and the stretches it is visible for. */
type Line = {
  key: string;
  bench?: boolean;
  short: string;
  label: string;
  hue: string;
  segs: Pt[][];
  bridges: [number, number, number][];
  stats: Stats;
};

export function EquityCurve() {
  const [on, setOn] = useState<Set<string>>(
    () => new Set(BANDS.map((b) => b.key)),
  );
  const [mode, setMode] = useState<Mode>("combined");

  const curve = data.curve as Pt[];

  const view = useMemo(() => {
    const live = BANDS.filter((b) => on.has(b.key));
    if (!live.length) return null;

    const ranges = BANDS.map((b) => ({
      key: b.key,
      lo: dayOf(b.from),
      hi: dayOf(b.to),
    }));
    const keyAt = (d: number) =>
      ranges.find((r) => d >= r.lo && d <= r.hi)?.key ?? null;

    //  The days on screen, once, in order. Both readings walk the same list.
    const idx: number[] = [];
    for (let i = 0; i < curve.length; i++) {
      const k = keyAt(curve[i][0]);
      if (k && on.has(k)) idx.push(i);
    }
    if (idx.length < 2) return null;

    /*  Hiding a window REBASES what is left to the same starting capital, and
        rebuilds it from each visible day's own change — so dropping a window
        removes that window's P&L and nothing else. Showing "Live" alone
        opening at $194k would contradict its own "+55%", because that 55% is
        55% of $15k.

        `split` decides where a line BREAKS: the combined reading breaks at
        every window boundary so each window can carry its own colour, the
        per-strategy reading only where a window was actually removed.       */
    const walk = (
      valueAt: (i: number) => number,
      split: (i: number, prev: number) => boolean,
    ) => {
      const segs: Pt[][] = [];
      const bridges: [number, number, number][] = [];
      let level = START;
      let cur: Pt[] = [];
      for (let n = 0; n < idx.length; n++) {
        const i = idx[n];
        //  The first day on screen IS the opening balance, so it contributes
        //  no change — the same treatment the exporter gives the curve's start.
        if (n > 0) level += valueAt(i) - valueAt(idx[n - 1]);
        if (n > 0 && split(i, idx[n - 1])) {
          //  Where a window was removed, the two stretches either side are
          //  still joined in money but not in time. The bridge says so.
          if (curve[i][0] - curve[idx[n - 1]][0] > 5 && cur.length) {
            bridges.push([curve[idx[n - 1]][0], curve[i][0], level]);
          }
          if (cur.length > 1) segs.push(cur);
          cur = [];
        }
        cur.push([curve[i][0], level]);
      }
      if (cur.length > 1) segs.push(cur);
      return { segs, bridges };
    };

    const lines: Line[] = (
      mode === "combined"
        ? (() => {
            //  One walk, then hand each window the stretches that are its own.
            const w = walk(
              (i) => curve[i][1],
              (i, prev) => keyAt(curve[i][0]) !== keyAt(curve[prev][0]),
            );
            return live.map((b) => {
              const lo = dayOf(b.from);
              const hi = dayOf(b.to);
              return {
                key: b.key,
                short: b.label,
                label: b.label,
                hue: HUE[b.key],
                segs: w.segs.filter((sg) => sg[0][0] >= lo && sg[0][0] <= hi),
                bridges: w.bridges.filter(([, end]) => end >= lo && end <= hi),
                stats: b.stats,
              };
            });
          })()
        : LEGS.map((leg, k) => {
            const w = walk(
              (i) => START + leg.series[i],
              (i, prev) => curve[i][0] - curve[prev][0] > 5,
            );
            return {
              key: `leg-${k}`,
              short: letterOf(k),
              label: legName(k, leg),
              hue: hueOf(k),
              segs: w.segs,
              bridges: w.bridges,
              stats: leg.stats,
            };
          }));

    //  The baseline splices across a hidden window exactly as the book does —
    //  the dollar moves of a $15k position, added up over the days on screen.
    //  Over the full history that is buy-and-hold to the cent; under a filter
    //  both sides lose the same days, which is what keeps them comparable.
    if (BENCH) {
      const w = walk(
        (i) => START * BENCH.rel[i],
        (i, prev) => curve[i][0] - curve[prev][0] > 5,
      );
      if (w.segs.length) {
        lines.push({
          key: "bench",
          bench: true,
          short: "S&P",
          label: BENCH.label,
          hue: BENCH_HUE,
          segs: w.segs,
          bridges: w.bridges,
          stats: BENCH.by?.[live.map((b) => b.key).join("+")] ?? BENCH.stats,
        });
      }
    }

    const pts = lines.flatMap((l) => l.segs.flat());
    if (pts.length < 2) return null;

    /*  One row per day per line, for the hover read-out. Drawdown is measured
        off the peak of WHAT IS SHOWN, so it answers the question the reader is
        actually asking — how far below its own high was this on that day — and
        it is the same %-of-peak basis the cards use.                        */
    const flat = lines.map((l) => {
      const rows: { d: number; v: number; pnl: number; dd: number }[] = [];
      let peak = START;
      for (const sg of l.segs) {
        for (const [d, v] of sg) {
          if (v > peak) peak = v;
          rows.push({
            d,
            v,
            pnl: rows.length ? v - rows[rows.length - 1].v : 0,
            dd: peak > 0 ? ((peak - v) / peak) * 100 : 0,
          });
        }
      }
      return rows;
    });

    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    //  LINEAR. The curve is sized STATICALLY — every trade risks a fixed slice
    //  of the starting balance, so a dollar of 2026 P&L is a dollar of 2018
    //  P&L and equal vertical distance means equal money. That is the whole
    //  point of the static basis, and a log axis would throw it away.
    return {
      lines,
      flat,
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: Math.min(...ys),
      y1: Math.max(...ys),
    };
  }, [on, curve, mode]);

  const W = 1000;
  const H = 340;
  const PAD = { t: 14, r: 16, b: 26, l: 62 };

  /*  Hover read-out. The indices are into `view.flat`, which is rebuilt
      whenever a window or the mode is toggled, so every read of it has to
      tolerate being stale by one render.                                    */
  const svgRef = useRef<SVGSVGElement>(null);
  const [hit, setHit] = useState<{ line: number; i: number } | null>(null);
  /*  One strategy pulled to the front. Eight lines is a mix you can see the
      SHAPE of but not read one line out of; clicking its card answers "which
      of these is that" without hiding the comparison it sits in.          */
  const [focus, setFocus] = useState<string | null>(null);

  //  The walkthrough needs the per-strategy cards on screen to point at them.
  //  It asks through an event instead of owning `mode`, so the chart behaves
  //  identically with the tour removed.
  useEffect(() => {
    const onMode = (e: Event) => {
      const want = (e as CustomEvent<Mode>).detail;
      if (want === "combined" || want === "legs") {
        setMode(want);
        setHit(null);
      }
    };
    window.addEventListener("tour:mode", onMode);
    return () => window.removeEventListener("tour:mode", onMode);
  }, []);

  const toggle = (k: string) =>
    setOn((prev) => {
      const next = new Set(prev);
      //  Never leave the chart empty — one window always stays on.
      if (next.has(k)) {
        if (next.size === 1) return prev;
        next.delete(k);
      } else next.add(k);
      return next;
    });

  //  Coordinates are ROUNDED to 2dp. Floating-point results are not required
  //  to agree to the last ULP between two engines, and any disagreement lands
  //  in the path `d` string and trips React's hydration check. Two decimals on
  //  a 1000x340 viewBox is sub-pixel.
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const px = (d: number) =>
    !view
      ? 0
      : r2(
          PAD.l +
            ((d - view.x0) / Math.max(view.x1 - view.x0, 1)) *
              (W - PAD.l - PAD.r),
        );
  const py = (v: number) => {
    if (!view) return 0;
    return r2(
      PAD.t +
        (1 - (v - view.y0) / Math.max(view.y1 - view.y0, 1e-9)) *
          (H - PAD.t - PAD.b),
    );
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const el = svgRef.current;
    if (!el || !view) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    if (x < PAD.l - 6 || x > W - PAD.r + 6) {
      setHit(null);
      return;
    }
    const day =
      view.x0 +
      ((x - PAD.l) / Math.max(W - PAD.l - PAD.r, 1)) * (view.x1 - view.x0);

    //  Nearest day on each line (they are sorted, so a bisect), then the line
    //  whose point is nearest the cursor VERTICALLY. With eight lines on
    //  screen, picking by x alone would always answer with the first one.
    let best: { line: number; i: number } | null = null;
    let bestDy = Infinity;
    view.flat.forEach((rows, li) => {
      if (rows.length < 2) return;
      let lo = 0;
      let hi = rows.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (rows[mid].d < day) lo = mid + 1;
        else hi = mid;
      }
      if (lo > 0 && Math.abs(rows[lo - 1].d - day) < Math.abs(rows[lo].d - day)) {
        lo -= 1;
      }
      const dy = Math.abs(py(rows[lo].v) - y);
      if (dy < bestDy) {
        bestDy = dy;
        best = { line: li, i: lo };
      }
    });
    setHit(best);
  };

  //  Round-money labels on a 1-2-5 ladder, ~3 of them. Even steps are what a
  //  linear axis is for: the reader can measure the gap between two lines.
  const ticks = useMemo(() => {
    if (!view) return [];
    const span = Math.max(view.y1 - view.y0, 1);
    const raw = span / 3;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = (raw / mag >= 5 ? 5 : raw / mag >= 2 ? 2 : 1) * mag;
    const out: number[] = [];
    for (let v = Math.ceil(view.y0 / step) * step; v <= view.y1; v += step) {
      out.push(Math.round(v));
    }
    return out;
  }, [view]);

  const years = useMemo(() => {
    if (!view) return [];
    const a = dayToDate(view.x0).getUTCFullYear();
    const b = dayToDate(view.x1).getUTCFullYear();
    const out: { d: number; y: number }[] = [];
    for (let y = a; y <= b; y++) {
      const d = Math.round((Date.UTC(y, 0, 1) - EPOCH) / DAY);
      if (d >= view.x0 && d <= view.x1) out.push({ d, y });
    }
    //  Thin the labels on a long window so they never collide.
    const step = Math.ceil(out.length / 10);
    return out.filter((_, i) => i % step === 0);
  }, [view]);

  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(Math.max(v, lo), hi);

  const origin = (() => {
    if (!view) return null;
    const f = view.lines.find((l) => l.segs.length);
    if (!f) return null;
    const p0 = f.segs[0][0];
    return { x: px(p0[0]), y: py(p0[1]), v: p0[1] };
  })();

  /*  Label geometry, resolved before anything is drawn so the collision pass
      can see every block at once.

      COMBINED only. The block hangs BELOW each window's end point: above a
      point there is often nothing but the frame edge — that is what clipped
      the last window's label — while below there is always empty space, and
      the block clears the whole stretch it sits over so it never lands on a
      rising line.

      BY STRATEGY carries none. Eight labels stacked down the right-hand edge
      crowded the one thing that reading is for — comparing the SHAPES of
      eight lines — and every figure they held is on the card below.        */
  const ROW = 38;
  const marks: {
    key: string; short: string; label: string; hue: string; pct: number;
    bench: boolean;
    x: number; y: number; tx: number; ty: number; anchor: "middle" | "end";
  }[] = [];
  if (view) {
    //  Two point sets, because a label has to clear ITS OWN line. The
    //  baseline runs along the bottom of the frame; letting it into the book's
    //  clearance scan pushed every window label down onto the date axis and
    //  piled all three on top of each other.
    const ptsOf = (bench: boolean) =>
      view.lines
        .filter((l) => !!l.bench === bench)
        .flatMap((l) => l.segs.flat().map((pt) => [px(pt[0]), py(pt[1])] as const));
    const bookPts = ptsOf(false);
    const benchPts = ptsOf(true);
    const ends = view.lines
      .flatMap((l) => {
        //  Per-strategy mode drops the eight line labels — they crowded the
        //  one thing that reading is for — but keeps the baseline's, because
        //  an unlabelled dashed line is just a mystery.
        if (mode === "legs" && !l.bench) return [];
        const last = l.segs[l.segs.length - 1];
        if (!last || !l.stats) return [];
        const p = last[last.length - 1];
        //  What THIS line added, not the level it reached. A window's line
        //  opens where the previous window closed, so the level at its end is
        //  the book's running total; the difference across its own span is its
        //  own contribution. A leg's line opens at the starting capital, so
        //  the same subtraction gives that strategy's share. Both are measured
        //  against the same $15k, which is what lets them be read against each
        //  other — and what makes the figures on screen sum to the total.
        const open = l.segs[0][0][1];
        return [{
          key: l.key, short: l.short, label: l.label, hue: l.hue,
          bench: !!l.bench,
          pct: ((p[1] - open) / START) * 100,
          x: px(p[0]), y: py(p[1]),
        }];
      })
      .sort((a, b) => a.x - b.x);

    let prev: { x: number; ty: number } | null = null;
    for (const e of ends) {
      //  Near the right edge a centred label would run out of the frame, so it
      //  turns back inward and hangs off its own end instead.
      const right = e.x > W - PAD.r - 80;
      const tx = clamp(e.x, PAD.l + 40, W - PAD.r - 4);
      const span: [number, number] = right ? [tx - 104, tx] : [tx - 48, tx + 48];
      let below = e.y;
      //  In per-strategy mode the eight legs are drawn too, and the baseline's
      //  label was landing on top of them — clearing its own line is not
      //  enough when eight others run through the same space.
      const clearance = e.bench
        ? mode === "legs"
          ? [...benchPts, ...bookPts]
          : benchPts
        : bookPts;
      for (const [cx, cy] of clearance) {
        if (cx >= span[0] && cx <= span[1] && cy > below) below = cy;
      }
      let ty = below + 22;
      if (prev && Math.abs(prev.x - e.x) < 130) ty = Math.max(ty, prev.ty + ROW);
      ty = clamp(ty, PAD.t + 16, H - PAD.b - 6);
      marks.push({ ...e, anchor: right ? "end" : "middle", tx, ty });
      prev = { x: e.x, ty };
    }
  }

  //  The window pills filter the per-strategy cards too, not just the chart:
  //  looking at the held-out years and reading whole-period numbers underneath
  //  them is how a reader mistakes one for the other. The combination is
  //  precomputed per leg, so these stay on the trade-stream basis every other
  //  figure on the page uses.
  const pick = BANDS.filter((b) => on.has(b.key)).map((b) => b.key).join("+");
  const cards: {
    key: string; label: string; hue: string; stats: Stats; bench?: boolean;
  }[] =
    mode === "combined"
      ? BANDS.map((b) => ({
          key: b.key, label: b.label, hue: HUE[b.key], stats: b.stats,
        }))
      : LEGS.map((leg, i) => ({
          key: `leg-${i}`,
          label: legName(i, leg),
          hue: hueOf(i),
          stats: leg.by?.[pick] ?? leg.stats,
        }));
  //  The baseline gets a card of its own, scored over the SAME window
  //  selection, because "better than the index?" is a comparison of four
  //  numbers and not of two end points.
  if (BENCH) {
    cards.push({
      key: "bench",
      label: BENCH.label,
      hue: BENCH_HUE,
      stats: BENCH.by?.[pick] ?? BENCH.stats,
      bench: true,
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div data-tour="periods" className="flex flex-wrap items-center gap-2">
        {BANDS.map((b) => {
          const active = on.has(b.key);
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => toggle(b.key)}
              aria-pressed={active}
              className={[
                "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] transition-colors",
                active
                  ? "border-border bg-card text-foreground"
                  : "border-transparent bg-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{
                  background: active ? HUE[b.key] : "var(--muted-foreground)",
                  opacity: active ? 1 : 0.4,
                }}
              />
              {b.label}
            </button>
          );
        })}
        </div>
        {/*  The same book, read two ways. A segmented control rather than two
            loose buttons: these are exclusive readings, not filters.       */}
        <div
          data-tour="mode"
          role="group"
          aria-label="Chart reading"
          className="ml-auto inline-flex overflow-hidden rounded-md border border-border"
        >
          {([["combined", "Combined"], ["legs", "By strategy"]] as const).map(
            ([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setHit(null);
                  setFocus(null);
                }}
                aria-pressed={mode === m}
                className={[
                  "px-3 py-1.5 text-[12px] transition-colors",
                  mode === m
                    ? "bg-card text-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </div>

      {/*  Nothing here looks clickable until someone clicks it, so say what
          the controls do rather than hoping a reader discovers them. On its
          own row: in the controls row it grew long enough in per-strategy
          mode to wrap the mode switch onto a line of its own.             */}
      <p className="mt-2 text-[12px] text-muted-foreground">
        Click a period to hide or show it · Hover the chart for a day&rsquo;s
        detail{mode === "legs" && " · Click a card to isolate that strategy"}
      </p>

      <figure
        data-tour="chart"
        className="mt-3 overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="overflow-x-auto">
          <svg
            ref={svgRef}
            onPointerMove={onMove}
            onPointerLeave={() => setHit(null)}
            viewBox={`0 0 ${W} ${H}`}
            className="block h-auto w-full min-w-[640px]"
            role="img"
            aria-label="Backtested equity curve of research portfolio 99, fixed position size, linear scale"
          >
            {view && (
              <>
                {ticks.map((v) => (
                  <g key={v}>
                    {/*  Faint enough to read a level off and no more — the
                        curve has to stay the brightest thing in the frame. */}
                    <line
                      x1={PAD.l}
                      x2={W - PAD.r}
                      y1={py(v)}
                      y2={py(v)}
                      stroke="var(--border)"
                      strokeOpacity={0.35}
                    />
                    {/*  The START block owns the gutter at its own height. A
                        tick landing there is dropped — its gridline stays, so
                        the axis keeps its ladder and only the colliding
                        number goes.                                        */}
                    {(!origin || Math.abs(py(v) - origin.y) > 20) && (
                      <text
                        x={PAD.l - 10}
                        y={py(v) + 3.5}
                        textAnchor="end"
                        className="font-mono"
                        fontSize="10"
                        fill="var(--muted-foreground)"
                      >
                        {fmtTick(v)}
                      </text>
                    )}
                  </g>
                ))}

                {years.map((t) => (
                  <text
                    key={t.y}
                    x={px(t.d)}
                    y={H - 8}
                    textAnchor="middle"
                    className="font-mono"
                    fontSize="10"
                    fill="var(--muted-foreground)"
                  >
                    {t.y}
                  </text>
                ))}

                {view.lines.map((l) => (
                  <g
                    key={l.key}
                    opacity={focus && l.key !== focus ? 0.14 : 1}
                  >
                    {l.bridges.map(([a, b, v]) => (
                      <line
                        key={`${l.key}-bridge-${a}`}
                        x1={px(a)}
                        x2={px(b)}
                        y1={py(v)}
                        y2={py(v)}
                        stroke={mode === "combined" ? "var(--muted-foreground)" : l.hue}
                        strokeOpacity={0.5}
                        strokeDasharray="3 4"
                      />
                    ))}
                    {l.segs.map((sg, si) => {
                      const d = sg
                        .map((p, i) => `${i ? "L" : "M"}${px(p[0])},${py(p[1])}`)
                        .join(" ");
                      return (
                        <g key={`${l.key}-${si}`}>
                          {/*  The filled area reads as "the book", and only
                              does so while one line IS the book. Eight
                              overlapping washes would read as mud.        */}
                          {mode === "combined" && !l.bench && (
                            <path
                              d={`${d} L${px(sg[sg.length - 1][0])},${H - PAD.b} L${px(sg[0][0])},${H - PAD.b} Z`}
                              fill={l.hue}
                              opacity={0.08}
                            />
                          )}
                          <path
                            d={d}
                            fill="none"
                            stroke={l.hue}
                            strokeWidth={
                              l.bench ? 1.5
                                : mode === "combined" ? 2
                                : l.key === focus ? 2.4 : 1.5
                            }
                            strokeOpacity={l.bench ? 0.75 : 1}
                            strokeDasharray={l.bench ? "5 4" : undefined}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        </g>
                      );
                    })}
                  </g>
                ))}

                {/*  The starting capital reads as the first mark in the same
                    CAPTION / VALUE shape as the lines, but it sits in the axis
                    gutter rather than over the plot: the curve opens in the
                    bottom-left corner, so there is no clear room inside the
                    frame for it to hang in.                                 */}
                {origin && (
                  <g>
                    <circle
                      cx={origin.x}
                      cy={origin.y}
                      r={3.5}
                      fill="var(--muted-foreground)"
                    />
                    <circle
                      cx={origin.x}
                      cy={origin.y}
                      r={6.5}
                      fill="none"
                      stroke="var(--muted-foreground)"
                      strokeOpacity={0.3}
                    />
                    <line
                      x1={origin.x - 8}
                      x2={PAD.l - 48}
                      y1={origin.y}
                      y2={origin.y}
                      stroke="var(--muted-foreground)"
                      strokeOpacity={0.45}
                      strokeDasharray="2 3"
                    />
                    <text
                      x={PAD.l - 10}
                      y={origin.y - 6}
                      textAnchor="end"
                      className="font-mono"
                      fontSize="9.5"
                      letterSpacing="0.08em"
                      fill="var(--muted-foreground)"
                    >
                      START
                    </text>
                    <text
                      x={PAD.l - 10}
                      y={origin.y + 8}
                      textAnchor="end"
                      className="font-mono"
                      fontSize="14"
                      fontWeight={700}
                      fill="var(--foreground)"
                    >
                      {fmtTick(origin.v)}
                    </text>
                  </g>
                )}

                {/*  What each line ADDED, as a share of the starting capital.
                    Static sizing is what makes those shares addable.       */}
                {marks.map((m) => (
                  <g key={m.key}>
                    <circle cx={m.x} cy={m.y} r={3.5} fill={m.hue} />
                    <circle
                      cx={m.x}
                      cy={m.y}
                      r={6.5}
                      fill="none"
                      stroke={m.hue}
                      strokeOpacity={0.3}
                    />
                    <line
                      x1={m.x}
                      x2={m.x}
                      y1={m.y + 8}
                      y2={m.ty - 10}
                      stroke={m.hue}
                      strokeOpacity={0.45}
                      strokeDasharray="2 3"
                    />
                    <text
                      x={m.tx}
                      y={m.ty}
                      textAnchor={m.anchor}
                      className="font-mono"
                      fontSize="9.5"
                      letterSpacing="0.08em"
                      fill="var(--muted-foreground)"
                    >
                      {m.label.toUpperCase()}
                    </text>
                    <text
                      x={m.tx}
                      y={m.ty + 15}
                      textAnchor={m.anchor}
                      className="font-mono"
                      fontSize="14"
                      fontWeight={700}
                      fill={m.hue}
                    >
                      +{Math.round(m.pct)}%
                    </text>
                  </g>
                ))}

                {/*  Daily read-out. Drawn last so it covers the line marks
                    rather than fighting them.                              */}
                {hit && view.flat[hit.line]?.[hit.i] && (() => {
                  const line = view.lines[hit.line];
                  const h = view.flat[hit.line][hit.i];
                  const hx = px(h.d);
                  const hy = py(h.v);
                  const BW = 200;
                  const rows: [string, string, string][] = [
                    ...(mode === "legs"
                      ? ([["STRATEGY", line.label, line.hue]] as [string, string, string][])
                      : []),
                    ["DATE", fmtDay(h.d), "var(--foreground)"],
                    ["BALANCE", fmtExact(h.v), "var(--foreground)"],
                    [
                      "DAY P&L",
                      fmtPct((h.pnl / START) * 100),
                      h.pnl >= 0 ? "var(--chart-3)" : "var(--chart-4)",
                    ],
                    [
                      "DRAWDOWN",
                      h.dd > 0.05 ? `-${h.dd.toFixed(2)}%` : "at high",
                      h.dd > 0.05 ? "var(--chart-4)" : "var(--muted-foreground)",
                    ],
                  ];
                  const BH = 18 + rows.length * 19;
                  const bx = hx + 16 + BW > W - PAD.r ? hx - 16 - BW : hx + 16;
                  const by = clamp(hy - BH / 2, PAD.t + 2, H - PAD.b - BH - 2);
                  return (
                    <g pointerEvents="none">
                      <line
                        x1={hx}
                        x2={hx}
                        y1={PAD.t}
                        y2={H - PAD.b}
                        stroke="var(--muted-foreground)"
                        strokeOpacity={0.45}
                      />
                      <circle
                        cx={hx}
                        cy={hy}
                        r={4}
                        fill={line.hue}
                        stroke="var(--card)"
                        strokeWidth={1.5}
                      />
                      <rect
                        x={bx}
                        y={by}
                        width={BW}
                        height={BH}
                        rx={8}
                        fill="var(--card)"
                        stroke="var(--border)"
                      />
                      {rows.map(([k, v, c], i) => (
                        <g key={k}>
                          <text
                            x={bx + 12}
                            y={by + 21 + i * 19}
                            className="font-mono"
                            fontSize="9"
                            letterSpacing="0.08em"
                            fill="var(--muted-foreground)"
                          >
                            {k}
                          </text>
                          <text
                            x={bx + BW - 12}
                            y={by + 21 + i * 19}
                            textAnchor="end"
                            className="font-mono"
                            fontSize="11.5"
                            fill={c}
                          >
                            {v}
                          </text>
                        </g>
                      ))}
                    </g>
                  );
                })()}
              </>
            )}
          </svg>
        </div>
      </figure>

      <div
        data-tour="cards"
        className={[
          "mt-4 grid gap-3",
          "sm:grid-cols-2 lg:grid-cols-4",
        ].join(" ")}
      >
        {cards.map((c) => {
          const st = c.stats;
          //  A window card dims when its window is switched off. A strategy
          //  card dims when ANOTHER strategy is the one being isolated.
          const active = c.bench
            ? true
            : mode === "legs"
              ? !focus || focus === c.key
              : on.has(c.key);
          const brief = !!st && st.years < 0.75;
          const Tag = mode === "legs" && !c.bench ? "button" : "div";
          return (
            <Tag
              key={c.key}
              {...(mode === "legs" && !c.bench
                ? {
                    type: "button" as const,
                    onClick: () =>
                      setFocus((f) => (f === c.key ? null : c.key)),
                    "aria-pressed": focus === c.key,
                  }
                : {})}
              className={[
                "rounded-xl border bg-card p-4 text-left transition-opacity",
                focus === c.key ? "border-muted-foreground" : "border-border",
                active ? "opacity-100" : "opacity-40",
                mode === "legs" && !c.bench ? "cursor-pointer hover:opacity-100" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                {c.bench ? (
                  <span
                    aria-hidden
                    className="h-0.5 w-3 shrink-0"
                    style={{
                      backgroundImage:
                        `repeating-linear-gradient(90deg, ${c.hue} 0 4px, transparent 4px 7px)`,
                    }}
                  />
                ) : (
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: c.hue }}
                  />
                )}
                <span className="text-sm font-medium">{c.label}</span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {st?.from} → {st?.to}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  //  Over a window this short the annualised figure is a
                  //  projection off a handful of weeks, so the card shows what
                  //  the period actually made instead.
                  brief
                    ? ["Return", st ? `${st.return_pct}%` : "—"]
                    : ["Return / yr", st ? `${st.cagr_pct}%` : "—"],
                  ["Max DD", st ? `${st.max_dd_pct}%` : "—"],
                  ["Calmar", st?.calmar ?? "—"],
                  ["Sharpe", st?.sharpe ?? "—"],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {k}
                    </dt>
                    <dd className="font-mono text-sm tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              {/*  A per-year figure off a two-month window is an
                  extrapolation, and the shorter the window the louder it
                  shouts. Say so on the card itself rather than hoping the
                  date range above it is read.                             */}
              {brief && st && (
                <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Only {(st.years * 12).toFixed(1)} months, so Return is the
                  period total, not annualised. Calmar still divides an
                  annualised return by the drawdown — read it as a sample, not
                  a track record.
                </p>
              )}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
