"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import surface from "@/data/sweep-surface.json";

/*  A REAL PARAMETER SWEEP, AS A SURFACE YOU CAN TURN.
 *
 *  A flat heatmap encodes one number in colour and the eye reads it as a map
 *  of where the good cells are. What it cannot show is the SHAPE of the good
 *  region, and the shape is the whole question: a lone needle and a broad rise
 *  are the same shade. Lifting the number into height makes a needle obviously
 *  a needle — and letting the reader rotate it is what proves the needle is
 *  not just a ridge seen end-on.
 *
 *  AXES ARE UNLABELLED ON PURPOSE — they are two parameters of a real
 *  strategy, and the exporter ships grid INDICES rather than their values.
 *
 *  Drawn by hand rather than with a 3-D library: ~400 quads of static data,
 *  one rotation, and a painter's-algorithm sort.
 */

type Grid = (number | null)[][];
type Mode = "is" | "oos";

const NX = surface.nx as number;
const NY = surface.ny as number;
const Z: Record<Mode, Grid> = {
  is: surface.z.is as Grid,
  oos: surface.z.oos as Grid,
};

const MODES: { key: Mode; label: string; sub: string }[] = [
  { key: "is", label: "In-sample", sub: `${surface.windows.is.years} yrs · fitted` },
  { key: "oos", label: "Out-of-sample", sub: `${surface.windows.oos.years} yrs · held out` },
];

const PLATEAU = surface.plateau as {
  cells: [number, number][];
  n: number;
  threshold: number;
  is_mean: number;
  is_min: number;
  oos_mean: number;
  oos_min: number;
  oos_top_quartile: number;
  oos_rank_mean: number;
};
const PEAKS = surface.peaks as {
  i: number; j: number; is: number; around: number; oos: number; oos_rank: number;
}[];
const IN_PLATEAU = new Set(PLATEAU.cells.map(([i, j]) => `${i},${j}`));
const onPlateau = (i: number, j: number) => IN_PLATEAU.has(`${i},${j}`);

/* ------------------------------------------------------------ geometry -- */

const CELL = 18;
const RISE = 112; // screen px between the lowest reading and the highest

/*  The surface spins about its own centre, so the drawing never needs more
    room than its half-diagonal however far it is turned. A constant width
    means the chart does not breathe while it is being dragged.             */
const R = Math.hypot((NX - 1) / 2, (NY - 1) / 2) * CELL;
const PAD = { l: 44, r: 12, t: 18, b: 24 };

const DEFAULT_VIEW = { yaw: -0.62, pitch: 0.48 };
const MIN_PITCH = 0.1;
const MAX_PITCH = 0.68;

/*  EACH WINDOW GETS ITS OWN VERTICAL SCALE.
 *
 *  A shared scale was tried first and made the fitted surface unreadable: the
 *  held-out window reaches 5.4 and the fitted one barely 1.6, so sharing
 *  squashed the in-sample terrain into the bottom fifth of the box. Nothing
 *  here argues that one window is taller than the other — it is about the
 *  SHAPE of each — so each fills its own box and the axis says which.
 */
function span(grid: Grid) {
  const v = grid.flat().filter((x): x is number => x != null);
  return { lo: Math.min(...v), hi: Math.max(...v) };
}
const SPAN: Record<Mode, { lo: number; hi: number }> = {
  is: span(Z.is),
  oos: span(Z.oos),
};

const r1 = (n: number) => Math.round(n * 10) / 10;

type View = { yaw: number; pitch: number };
type Pt = { x: number; y: number; d: number };

/** Yaw about the vertical axis, then flatten by pitch. `d` is depth: bigger is
 *  nearer the viewer, which is all the painter's algorithm needs. */
function projector(mode: Mode, view: View) {
  const { lo, hi } = SPAN[mode];
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const sp = Math.sin(view.pitch);
  const ox = PAD.l + R;
  //  Centred for the TALLEST box the chart can ever need, not for the current
  //  tilt. Using `sp` here made the drawing area shrink as the surface was
  //  tilted flatter, so the card resized under the cursor mid-drag.
  const oy = PAD.t + RISE + R * Math.sin(MAX_PITCH);

  return (i: number, j: number, z: number): Pt => {
    const u = (i - (NX - 1) / 2) * CELL;
    const v = (j - (NY - 1) / 2) * CELL;
    const x = u * cy - v * sy;
    const d = u * sy + v * cy;
    const t = (z - lo) / (hi - lo || 1);
    return { x: r1(ox + x), y: r1(oy + d * sp - t * RISE), d };
  };
}

const BOX_W = PAD.l + 2 * R + PAD.r;
//  Cut once, for the worst case: the grid turned to its diagonal and tilted as
//  far as the clamp allows. Constant, so dragging never reflows the page.
const BOX_H = PAD.t + RISE + 2 * R * Math.sin(MAX_PITCH) + PAD.b;

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
const zTicks = (mode: Mode) =>
  [0, 0.25, 0.5, 0.75, 1].map((t) => SPAN[mode].lo + t * (SPAN[mode].hi - SPAN[mode].lo));

/* ------------------------------------------------------------- render -- */

type Quad = { d: string; fill: string; depth: number; plateau: boolean };

function mesh(mode: Mode, view: View): Quad[] {
  const grid = Z[mode];
  const at = projector(mode, view);
  const out: Quad[] = [];
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
        //  A face counts as plateau if ANY corner is in the region. Requiring
        //  all four drew the 33-cell band as a scatter of disconnected
        //  diamonds — technically its interior, and unreadable as an area.
        plateau:
          onPlateau(i, j) ||
          onPlateau(i + 1, j) ||
          onPlateau(i + 1, j + 1) ||
          onPlateau(i, j + 1),
      });
    }
  }
  //  PAINTER'S ALGORITHM: far faces first, so near ridges cover them.
  return out.sort((m, n) => m.depth - n.depth);
}

export function SweepSurface() {
  const [mode, setMode] = useState<Mode>("is");
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);

  const at = useMemo(() => projector(mode, view), [mode, view]);
  const quads = useMemo(() => mesh(mode, view), [mode, view]);

  const onDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, ...view };
      setDragging(true);
    },
    [view],
  );
  const onMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    //  Horizontal drag spins, vertical drag tilts. Pitch is clamped: past
    //  vertical the surface folds through itself and the depth sort stops
    //  meaning anything.
    setView({
      yaw: d.yaw + (e.clientX - d.x) * 0.009,
      pitch: Math.min(MAX_PITCH, Math.max(MIN_PITCH, d.pitch + (e.clientY - d.y) * 0.006)),
    });
  }, []);
  const onUp = useCallback(() => {
    drag.current = null;
    setDragging(false);
  }, []);

  const pins = PEAKS.map((p) => {
    const z = Z[mode][p.j]?.[p.i];
    if (z == null) return null;
    return { ...p, top: at(p.i, p.j, z), foot: at(p.i, p.j, SPAN[mode].lo), z };
  }).filter((p): p is NonNullable<typeof p> => p != null);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium">
            One sweep &middot; {fmt(surface.configs)} configurations
          </p>
          <p className="mt-1 max-w-[58ch] text-[12px] leading-relaxed text-muted-foreground">
            Height and colour are the same number: the best Calmar reachable at
            each point of a two-parameter grid. Axes left unlabelled on purpose.
          </p>
        </div>

        <div
          role="group"
          aria-label="Evaluation window"
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

      <p className="mt-2 flex items-center justify-center gap-2 text-[11.5px] text-muted-foreground">
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[11px]"
        >
          &#8634;
        </span>
        Drag the chart to rotate it &middot; double-click to reset
      </p>

      <div className="mt-1 flex items-center justify-center gap-5">
        <svg
          viewBox={`0 0 ${r1(BOX_W)} ${r1(BOX_H)}`}
          className={[
            //  Height-capped as well as width-capped: the section has a
            //  heading, a toggle, a hint line and three notes around it, and
            //  all of that has to sit on one screen.
            "max-h-[58vh] w-full max-w-[600px] touch-none select-none",
            dragging ? "cursor-grabbing" : "cursor-grab",
          ].join(" ")}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onDoubleClick={() => setView(DEFAULT_VIEW)}
          role="img"
          aria-label={`Parameter sweep surface, ${mode === "is" ? "in-sample" : "out-of-sample"} Calmar, with the plateau and the isolated peaks marked. Drag to rotate.`}
        >
          <Frame mode={mode} at={at} />

          {quads.map((q, k) =>
            q.plateau ? (
              //  Two passes over the same face, in place: the terrain colour,
              //  then a green wash and outline. A separate overlay layer would
              //  float the wash over ridges standing in front of it.
              <g key={k}>
                <path d={q.d} fill={q.fill} />
                <path
                  d={q.d}
                  fill="var(--chart-3)"
                  fillOpacity="0.5"
                  stroke="var(--chart-3)"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
              </g>
            ) : (
              <path
                key={k}
                d={q.d}
                fill={q.fill}
                fillOpacity="0.55"
                stroke="rgba(255,255,255,0.10)"
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
            ),
          )}

          {pins.map((p) => (
            <Pin
              key={`${p.i},${p.j}`}
              at={p}
              tone="var(--chart-4)"
              label={`Peak · ${p.z.toFixed(2)}`}
              sub={`neighbours ${p.around.toFixed(2)}`}
              anchor={p.top.x > BOX_W / 2 ? "end" : "start"}
            />
          ))}
        </svg>

        <ColourBar mode={mode} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Note tone="var(--chart-3)" title="Plateau — pick">
          {PLATEAU.n} adjacent settings, worst of them{" "}
          {PLATEAU.is_min.toFixed(2)}. One step off costs nothing.
        </Note>
        <Note tone="var(--chart-4)" dot title="Peak — avoid">
          {PEAKS[0].is.toFixed(2)}, neighbours {PEAKS[0].around.toFixed(2)}.
          Nothing holding it up.
        </Note>
        <Note tone="var(--muted-foreground)" dot title="Out of sample">
          The region stays top-{100 - PLATEAU.oos_rank_mean}%. The peaks land at{" "}
          {PEAKS.map((p) => `${p.oos_rank}th`).join(" and ")} &mdash; a coin flip.
        </Note>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- box --- */

/*  The bounding box. Without it the surface floats: there is no telling a tall
 *  ridge from a near one, and no reading a height off it. Everything here is
 *  recomputed from the current rotation — including WHICH upright carries the
 *  value ticks, because after a half-turn the old one is on the far side.
 */
function Frame({
  mode,
  at,
}: {
  mode: Mode;
  at: (i: number, j: number, z: number) => Pt;
}) {
  const { lo, hi } = SPAN[mode];
  const corners: [number, number][] = [
    [0, 0],
    [NX - 1, 0],
    [NX - 1, NY - 1],
    [0, NY - 1],
  ];
  const floor = corners.map(([i, j]) => at(i, j, lo));
  const roof = corners.map(([i, j]) => at(i, j, hi));

  const line = (p: Pt, q: Pt, op: number, key: string) => (
    <line
      key={key}
      x1={p.x}
      y1={p.y}
      x2={q.x}
      y2={q.y}
      stroke="var(--foreground)"
      strokeOpacity={op}
      strokeWidth="0.8"
    />
  );

  const edges = [];
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    edges.push(line(floor[k], floor[n], 0.16, `f${k}`));
    edges.push(line(roof[k], roof[n], 0.1, `r${k}`));
    edges.push(line(floor[k], roof[k], 0.12, `v${k}`));
  }
  for (let i = 0; i < NX; i += 3)
    edges.push(line(at(i, 0, lo), at(i, NY - 1, lo), 0.055, `gx${i}`));
  for (let j = 0; j < NY; j += 3)
    edges.push(line(at(0, j, lo), at(NX - 1, j, lo), 0.055, `gy${j}`));

  //  Ticks live on whichever upright is furthest LEFT on screen, so the numbers
  //  never end up behind the surface after a turn.
  const axis = corners[floor.reduce((best, p, k) => (p.x < floor[best].x ? k : best), 0)];
  const axisTop = at(axis[0], axis[1], hi);

  //  The two floor edges meeting at the NEAREST corner are the ones a reader
  //  can actually see, so the axis names sit on those.
  const near = floor.reduce((best, p, k) => (p.d > floor[best].d ? k : best), 0);
  /*  Same trap as the write-up's surface: `corners` runs (0,0) (nx-1,0)
   *  (nx-1,ny-1) (0,ny-1), so WHICH of (near+1) and (near+3) moves i flips
   *  with the parity of `near`. Hard-coding +1 as the x axis labels the two
   *  edges the wrong way round at half the rotations.                      */
  const nb1 = (near + 1) % 4;
  const nb3 = (near + 3) % 4;
  const iAxis = corners[nb1][0] !== corners[near][0] ? nb1 : nb3;
  const jAxis = iAxis === nb1 ? nb3 : nb1;

  const nameAt = (k: number, text: string) => {
    const a = floor[near];
    const b = floor[k];
    const mx = (a.x + b.x) / 2;
    return (
      <text
        key={text}
        x={mx + (mx > PAD.l + R ? 16 : -16)}
        y={(a.y + b.y) / 2 + 16}
        fontSize="9.5"
        fill="var(--muted-foreground)"
        textAnchor="middle"
      >
        {text}
      </text>
    );
  };

  return (
    <g>
      {edges}

      {zTicks(mode).map((z) => {
        const p = at(axis[0], axis[1], z);
        return (
          <g key={`z${z}`}>
            <line
              x1={p.x - 5}
              y1={p.y}
              x2={p.x}
              y2={p.y}
              stroke="var(--foreground)"
              strokeOpacity="0.3"
              strokeWidth="0.8"
            />
            <text
              x={p.x - 8}
              y={p.y + 3.5}
              textAnchor="end"
              fontSize="9"
              fill="var(--muted-foreground)"
            >
              {z.toFixed(1)}
            </text>
          </g>
        );
      })}
      {/*  Horizontal, and sat directly on top of the tick column it names
           rather than rotated away down the side of the chart.            */}
      <text
        x={axisTop.x - 8}
        y={axisTop.y - 10}
        textAnchor="end"
        fontSize="9.5"
        fill="var(--muted-foreground)"
      >
        Calmar
      </text>

      {nameAt(iAxis, "X-axis")}
      {nameAt(jAxis, "Y-axis")}
    </g>
  );
}

function Pin({
  at: p,
  tone,
  label,
  sub,
  anchor,
}: {
  at: { top: Pt; foot: Pt };
  tone: string;
  label: string;
  sub: string;
  anchor: "start" | "end";
}) {
  const dx = anchor === "end" ? -7 : 7;
  return (
    <g className="fade-late">
      <line
        x1={p.top.x}
        y1={p.top.y}
        x2={p.foot.x}
        y2={p.foot.y}
        stroke={tone}
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.6"
      />
      <circle cx={p.top.x} cy={p.top.y} r="3" fill={tone} />
      <text
        x={p.top.x + dx}
        y={p.top.y - 11}
        textAnchor={anchor}
        fontSize="10.5"
        fontWeight="600"
        fill="var(--foreground)"
      >
        {label}
      </text>
      <text
        x={p.top.x + dx}
        y={p.top.y - 1}
        textAnchor={anchor}
        fontSize="9.5"
        fill="var(--muted-foreground)"
      >
        {sub}
      </text>
    </g>
  );
}

function ColourBar({ mode }: { mode: Mode }) {
  const { lo, hi } = SPAN[mode];
  const marks = [hi, lo + (hi - lo) * 0.5, lo];
  return (
    <div className="flex h-[180px] shrink-0 flex-col items-start">
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
        Calmar
      </span>
      <div className="mt-2 flex flex-1 gap-1.5">
        <span
          aria-hidden
          className="w-2.5 rounded-sm"
          style={{
            background: `linear-gradient(to top, ${[0, 0.25, 0.5, 0.75, 1]
              .map((t) => ramp(t))
              .join(",")})`,
          }}
        />
        <span className="flex flex-col justify-between font-mono text-[9px] text-muted-foreground">
          {marks.map((v) => (
            <span key={v}>{v.toFixed(1)}</span>
          ))}
        </span>
      </div>
    </div>
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
        className={
          dot
            ? "mt-[6px] h-2.5 w-2.5 shrink-0 rounded-full"
            : "mt-[5px] h-3 w-3 shrink-0 rounded-[3px]"
        }
        style={
          dot
            ? { background: tone }
            : {
                background: `color-mix(in oklab, ${tone} 50%, transparent)`,
                border: `1.5px solid ${tone}`,
              }
        }
      />
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        <b className="font-medium text-foreground">{title}.</b> {children}
      </p>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("en-US");
