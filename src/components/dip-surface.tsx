"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import sweep from "@/data/dip-sweep.json";

/*  WAS 2% AND 22:00 A PLATEAU, OR DID THEY GET LUCKY?
 *
 *  The backtest above trades one threshold at one exit time. The fair
 *  objection is that both were chosen, and a result that only exists at the
 *  coordinates you happened to pick is not a result. So both knobs are swept
 *  and the whole surface shipped.
 *
 *  Axes are labelled here, unlike the one on the home page. That one is a
 *  deployed strategy and its coordinates are the edge; this one is written up
 *  precisely because it was killed, so there is nothing left to protect — and
 *  a reader can only check the claim if they can read the axes.
 *
 *  The marked cell is the published one, found by coordinate rather than by
 *  searching for the best cell. That is the point: it was picked before this
 *  ran.
 */

type Grid = (number | null)[][];
type Mode = "is" | "oos";

const NX = sweep.nx as number;
const NY = sweep.ny as number;
const XV = sweep.x.values as number[];
const YV = sweep.y.values as number[];
const Z: Record<Mode, Grid> = {
  is: sweep.z.is as Grid,
  oos: sweep.z.oos as Grid,
};
const CHOSEN = sweep.chosen as {
  i: number; j: number; is: number; oos: number; n_is: number; around: number;
};
const PLATEAU = sweep.plateau as {
  cells: [number, number][];
  n: number; bar: number;
  is_min: number; is_mean: number;
  oos_min: number | null; oos_mean: number | null;
};
const IN_PLATEAU = new Set(PLATEAU.cells.map(([i, j]) => `${i},${j}`));
const onPlateau = (i: number, j: number) => IN_PLATEAU.has(`${i},${j}`);

/*  "2018–2023" was typed in, and the held-out window grows every night.
 *
 *  The `to` is EXCLUSIVE — the fitted window ends at the split, 1 Jan 2024,
 *  and the last year it actually contains is 2023. Slicing the year straight
 *  off the string labelled it "2018–2024", claiming a year of data the window
 *  does not hold.                                                          */
const yearSpan = (w: { from: string; to: string }) => {
  const end = new Date(`${w.to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return `${w.from.slice(0, 4)}–${end.getUTCFullYear()}`;
};

const MODES: { key: Mode; label: string; sub: string }[] = [
  { key: "is", label: "Fitted", sub: yearSpan(sweep.windows.is) },
  { key: "oos", label: "Held out", sub: yearSpan(sweep.windows.oos) },
];

/* ------------------------------------------------------------ geometry -- */

const CELL = 26;
const RISE = 150;
const PAD = { l: 52, r: 18, t: 30, b: 42 };
const DEFAULT_VIEW = { yaw: -0.58, pitch: 0.5 };
const MIN_PITCH = 0.1;
const MAX_PITCH = 0.95;

const r1 = (n: number) => Math.round(n * 10) / 10;

type View = { yaw: number; pitch: number };
type Pt = { x: number; y: number; d: number };

function span(grid: Grid) {
  const v = grid.flat().filter((x): x is number => x != null);
  return { lo: Math.min(...v), hi: Math.max(...v) };
}
const SPAN: Record<Mode, { lo: number; hi: number }> = {
  is: span(Z.is),
  oos: span(Z.oos),
};

//  Fixed box: sized once for the grid turned to its diagonal at the steepest
//  tilt allowed, so dragging never reflows the page around the chart.
const REACH = (Math.hypot(NX - 1, NY - 1) * CELL) / 2;
const W = PAD.l + 2 * REACH + PAD.r;
const H = PAD.t + RISE + 2 * REACH * Math.sin(MAX_PITCH) + PAD.b;
const CX = PAD.l + REACH;
const CY = PAD.t + RISE + REACH * Math.sin(MAX_PITCH);

function projector(mode: Mode, view: View) {
  const { lo, hi } = SPAN[mode];
  const cyw = Math.cos(view.yaw);
  const syw = Math.sin(view.yaw);
  const sp = Math.sin(view.pitch);
  return (i: number, j: number, z: number): Pt => {
    const u = (i - (NX - 1) / 2) * CELL;
    const v = (j - (NY - 1) / 2) * CELL;
    return {
      x: r1(CX + u * cyw - v * syw),
      y: r1(CY + (u * syw + v * cyw) * sp - ((z - lo) / (hi - lo || 1)) * RISE),
      d: u * syw + v * cyw,
    };
  };
}

/* --------------------------------------------------------------- hues -- */

const STOPS: [number, number[]][] = [
  [0.0, [18, 26, 62]],
  [0.35, [26, 74, 140]],
  [0.58, [0, 194, 255]],
  [0.8, [147, 108, 255]],
  [1.0, [203, 60, 255]],
];
function ramp(t: number) {
  const u = Math.min(1, Math.max(0, t));
  for (let k = 1; k < STOPS.length; k++) {
    const [p0, c0] = STOPS[k - 1];
    const [p1, c1] = STOPS[k];
    if (u <= p1) {
      const f = (u - p0) / (p1 - p0 || 1);
      return `rgb(${c0.map((v, m) => Math.round(v + (c1[m] - v) * f)).join(",")})`;
    }
  }
  return `rgb(${STOPS[STOPS.length - 1][1].join(",")})`;
}
const hue = (mode: Mode, z: number) => {
  const { lo, hi } = SPAN[mode];
  return ramp((z - lo) / (hi - lo || 1));
};

const pctLabel = (v: number) => `${v}%`;
const hourLabel = (v: number) => `${String(v).padStart(2, "0")}:00`;

/* ------------------------------------------------------------- render -- */

type Face = { d: string; fill: string; depth: number; plateau: boolean };

function mesh(mode: Mode, at: (i: number, j: number, z: number) => Pt): Face[] {
  const grid = Z[mode];
  const out: Face[] = [];
  for (let j = 0; j < NY - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const a = grid[j][i];
      const b = grid[j][i + 1];
      const c = grid[j + 1][i + 1];
      const e = grid[j + 1][i];
      if (a == null || b == null || c == null || e == null) continue;
      const p = [at(i, j, a), at(i + 1, j, b), at(i + 1, j + 1, c), at(i, j + 1, e)];
      out.push({
        d: `M${p[0].x} ${p[0].y}L${p[1].x} ${p[1].y}L${p[2].x} ${p[2].y}L${p[3].x} ${p[3].y}Z`,
        fill: hue(mode, (a + b + c + e) / 4),
        depth: (p[0].d + p[1].d + p[2].d + p[3].d) / 4,
        plateau:
          onPlateau(i, j) || onPlateau(i + 1, j) ||
          onPlateau(i + 1, j + 1) || onPlateau(i, j + 1),
      });
    }
  }
  //  Painter's algorithm — far faces first, so near ridges cover them.
  return out.sort((m, n) => m.depth - n.depth);
}

export function DipSurface() {
  const [mode, setMode] = useState<Mode>("is");
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);

  const at = useMemo(() => projector(mode, view), [mode, view]);
  const faces = useMemo(() => mesh(mode, at), [mode, at]);

  const onDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ...view };
    setDragging(true);
  }, [view]);
  const onMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    setView({
      yaw: d.yaw + (e.clientX - d.x) * 0.009,
      pitch: Math.min(MAX_PITCH, Math.max(MIN_PITCH, d.pitch + (e.clientY - d.y) * 0.006)),
    });
  }, []);
  const onUp = useCallback(() => {
    drag.current = null;
    setDragging(false);
  }, []);

  const z = Z[mode][CHOSEN.j]?.[CHOSEN.i];
  const pin = z == null ? null : {
    top: at(CHOSEN.i, CHOSEN.j, z),
    foot: at(CHOSEN.i, CHOSEN.j, SPAN[mode].lo),
    z,
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium">
            Both knobs, swept &middot; {sweep.measured} combinations
          </p>
          <p className="mt-1 max-w-[56ch] text-[12px] leading-relaxed text-muted-foreground">
            Height and colour are the Calmar each pair of settings would have
            produced, net of the same spread, scored on the fitted years.
          </p>
        </div>
        <div
          role="group"
          aria-label="Window"
          className="flex shrink-0 overflow-hidden rounded-lg border border-border"
        >
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              aria-pressed={mode === m.key}
              className={[
                "px-3 py-2 text-left text-[12px] leading-tight transition-colors",
                mode === m.key
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {m.label}
              <span className="block font-mono text-[10px] text-muted-foreground">
                {m.sub}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[11px]"
        >
          &#8634;
        </span>
        Drag the chart to rotate it &middot; double-click to reset
      </p>

      <svg
        viewBox={`0 0 ${r1(W)} ${r1(H)}`}
        className={[
          //  Capped and centred. The viewBox is taller than it is wide, so at
          //  full column width the chart came out over a thousand pixels tall.
          "mx-auto mt-3 w-full max-w-[620px] touch-none select-none",
          dragging ? "cursor-grabbing" : "cursor-grab",
        ].join(" ")}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={() => setView(DEFAULT_VIEW)}
        role="img"
        aria-label="Calmar across every threshold and exit time, with the chosen pair marked"
      >
        <Frame mode={mode} at={at} />
        {faces.map((f, k) =>
          f.plateau ? (
            <g key={k}>
              <path d={f.d} fill={f.fill} />
              <path
                d={f.d}
                fill="var(--chart-3)"
                fillOpacity="0.42"
                stroke="var(--chart-3)"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </g>
          ) : (
            <path
              key={k}
              d={f.d}
              fill={f.fill}
              fillOpacity="0.6"
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="0.4"
              strokeLinejoin="round"
            />
          ),
        )}
        {pin && (
          <g className="fade-late">
            <line
              x1={pin.top.x} y1={pin.top.y} x2={pin.foot.x} y2={pin.foot.y}
              stroke="var(--chart-1)" strokeWidth="1"
              strokeDasharray="3 3" opacity="0.7"
            />
            <circle cx={pin.top.x} cy={pin.top.y} r="3.4" fill="var(--chart-1)" />
            <text
              x={pin.top.x + (pin.top.x > CX ? -8 : 8)}
              y={pin.top.y - 11}
              textAnchor={pin.top.x > CX ? "end" : "start"}
              fontSize="10.5" fontWeight="600" fill="var(--foreground)"
            >
              What the backtest traded &middot; {pin.z.toFixed(2)}
            </text>
            <text
              x={pin.top.x + (pin.top.x > CX ? -8 : 8)}
              y={pin.top.y - 1}
              textAnchor={pin.top.x > CX ? "end" : "start"}
              fontSize="9.5" fill="var(--muted-foreground)"
            >
              {pctLabel(XV[CHOSEN.i])} fall, out at {hourLabel(YV[CHOSEN.j])}
            </text>
          </g>
        )}
      </svg>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Note tone="var(--chart-1)" dot title="The chosen pair">
          Calmar {CHOSEN.is.toFixed(2)} on {CHOSEN.n_is} fitted trades, with its
          four neighbours averaging {CHOSEN.around.toFixed(2)}. It sits on the shoulder, not on
          a needle.
        </Note>
        <Note tone="var(--chart-3)" title="The region around it">
          {PLATEAU.n} settings reachable from it without stepping over anything
          that fails, worst of them {PLATEAU.is_min.toFixed(2)}
          {PLATEAU.oos_mean != null && <> &mdash; averaging {PLATEAU.oos_mean.toFixed(2)} on the held-out years</>}.
        </Note>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- box --- */

function Frame({
  mode,
  at,
}: {
  mode: Mode;
  at: (i: number, j: number, z: number) => Pt;
}) {
  const { lo, hi } = SPAN[mode];
  const corners: [number, number][] = [
    [0, 0], [NX - 1, 0], [NX - 1, NY - 1], [0, NY - 1],
  ];
  const floor = corners.map(([i, j]) => at(i, j, lo));
  const roof = corners.map(([i, j]) => at(i, j, hi));

  const line = (p: Pt, q: Pt, op: number, key: string) => (
    <line key={key} x1={p.x} y1={p.y} x2={q.x} y2={q.y}
          stroke="var(--foreground)" strokeOpacity={op} strokeWidth="0.8" />
  );

  const edges = [];
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    edges.push(line(floor[k], floor[n], 0.18, `f${k}`));
    edges.push(line(roof[k], roof[n], 0.09, `r${k}`));
    edges.push(line(floor[k], roof[k], 0.12, `v${k}`));
  }
  for (let i = 0; i < NX; i += 2) edges.push(line(at(i, 0, lo), at(i, NY - 1, lo), 0.06, `gx${i}`));
  for (let j = 0; j < NY; j += 2) edges.push(line(at(0, j, lo), at(NX - 1, j, lo), 0.06, `gy${j}`));

  const axis = corners[floor.reduce((b, p, k) => (p.x < floor[b].x ? k : b), 0)];
  const near = floor.reduce((b, p, k) => (p.d > floor[b].d ? k : b), 0);
  const ticks = [0, 0.5, 1].map((t) => lo + t * (hi - lo));

  //  Axis VALUES, not just names: the rule is public, so the reader should be
  //  able to find 2% and 22:00 on the picture for themselves.
  const sideTicks = (k: number, fmt: (v: number) => string, vals: number[], along: "x" | "y") => {
    const a = floor[near];
    const b = floor[k];
    const out = [];
    for (let s = 1; s < vals.length; s += 2) {
      const t = vals.length === 1 ? 0 : s / (vals.length - 1);
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(
        <text key={`${along}${s}`} x={p.x} y={p.y + 12} fontSize="8.5"
              textAnchor="middle" fill="var(--muted-foreground)">
          {fmt(vals[s])}
        </text>,
      );
    }
    return out;
  };

  const name = (k: number, text: string) => {
    const a = floor[near];
    const b = floor[k];
    const mx = (a.x + b.x) / 2;
    return (
      <text x={mx + (mx > CX ? 20 : -20)} y={(a.y + b.y) / 2 + 28}
            fontSize="9.5" textAnchor="middle" fill="var(--muted-foreground)">
        {text}
      </text>
    );
  };

  return (
    <g>
      {edges}
      {ticks.map((z) => {
        const p = at(axis[0], axis[1], z);
        return (
          <g key={z}>
            <line x1={p.x - 5} y1={p.y} x2={p.x} y2={p.y}
                  stroke="var(--foreground)" strokeOpacity="0.3" strokeWidth="0.8" />
            <text x={p.x - 8} y={p.y + 3.5} textAnchor="end" fontSize="9"
                  fill="var(--muted-foreground)">
              {z.toFixed(2)}
            </text>
          </g>
        );
      })}
      <text
        x={Math.max(2, at(axis[0], axis[1], hi).x - 40)}
        y={at(axis[0], axis[1], hi).y - 11}
        fontSize="9.5" fill="var(--muted-foreground)"
      >
        Calmar
      </text>

      {sideTicks((near + 1) % 4, pctLabel, XV, "x")}
      {sideTicks((near + 3) % 4, hourLabel, YV, "y")}
      {name((near + 1) % 4, sweep.x.label)}
      {name((near + 3) % 4, sweep.y.label)}
    </g>
  );
}

function Note({
  tone,
  title,
  dot = false,
  children,
}: {
  tone: string;
  title: string;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span
        aria-hidden
        className={dot
          ? "mt-[6px] h-2.5 w-2.5 shrink-0 rounded-full"
          : "mt-[5px] h-3 w-3 shrink-0 rounded-[3px]"}
        style={dot
          ? { background: tone }
          : {
              background: `color-mix(in oklab, ${tone} 45%, transparent)`,
              border: `1.5px solid ${tone}`,
            }}
      />
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        <b className="font-medium text-foreground">{title}.</b> {children}
      </p>
    </div>
  );
}
