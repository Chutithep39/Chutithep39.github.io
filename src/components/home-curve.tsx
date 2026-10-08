import data from "@/data/portfolio99.json";

/*  The home page's one chart: the LIVE window only, book against the index.
 *
 *  It used to plot 2018–2026, which put eight years of fitted and held-out
 *  backtest on the landing page under one undifferentiated line — the reader
 *  could not tell which part had been scored and which part had been traded.
 *  The full history, split into its windows and re-cuttable by strategy, is on
 *  /results; this shows the one window that is running now.
 *
 *  No axes and no controls, on purpose: it is the shape of the claim, and the
 *  numbers beside it carry the magnitudes.
 */
const START = data.start_balance as number;
const CURVE = data.curve as [number, number][];
const BENCH = data.benchmark as { label: string; rel: number[] };
const EPOCH = data.epoch as string;

type Band = { key: string; label: string; from: string; to: string };
const LIVE_BAND = (data.bands as Band[]).find((b) => b.key === "recent")!;

/*  Curve x values are days since `epoch`, not array positions — a missing
    session leaves a gap in the day count and none in the array.            */
const dayOf = (i: number) => {
  const t = new Date(`${EPOCH}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + CURVE[i][0]);
  return t.toISOString().slice(0, 10);
};

const W = 760;
const H = 260;
const PAD = 6;

const r2 = (n: number) => Math.round(n * 100) / 100;

type Pt = { x: number; y: number };

function build() {
  const idx: number[] = [];
  for (let i = 0; i < CURVE.length; i++) {
    const d = dayOf(i);
    if (d >= LIVE_BAND.from && d <= LIVE_BAND.to) idx.push(i);
  }

  /*  REBASE OFF THE DAY BEFORE THE WINDOW OPENS, not off its first close.
      Sizing here is static, so a window's return is the sum of its own daily
      moves — anchoring on the first close would silently drop day one and put
      the chart 0.2pp away from the figure printed next to it.              */
  const anchor = CURVE[Math.max(0, idx[0] - 1)];

  const book = idx.map((i) => START + (CURVE[i][1] - anchor[1]));
  const benchAnchor = START * (BENCH.rel[Math.max(0, idx[0] - 1)] ?? 1);
  const bench = idx.map(
    (i) => START + (START * (BENCH.rel[i] ?? 1) - benchAnchor),
  );

  const all = [...book, ...bench];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;

  const place = (vals: number[]): Pt[] =>
    vals.map((v, k) => ({
      x: r2((k / (vals.length - 1)) * (W - PAD * 2) + PAD),
      y: r2(H - PAD - ((v - lo) / span) * (H - PAD * 2)),
    }));

  return { book: place(book), bench: place(bench) };
}

const d = (pts: Pt[]) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");

const { book, bench } = build();

export function HomeCurve() {
  const floor = H - PAD;
  const area = `${d(book)} L${book[book.length - 1].x} ${floor} L${book[0].x} ${floor} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[220px] w-full sm:h-[260px]"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Live-window equity against ${BENCH.label}, ${LIVE_BAND.from} to ${LIVE_BAND.to}`}
    >
      <defs>
        <linearGradient id="home-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={area} fill="url(#home-fill)" />
      <path
        d={d(bench)}
        fill="none"
        stroke="var(--muted-foreground)"
        strokeOpacity="0.5"
        strokeWidth="1.5"
        strokeDasharray="5 4"
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="draw-line"
        d={d(book)}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth="2.25"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
