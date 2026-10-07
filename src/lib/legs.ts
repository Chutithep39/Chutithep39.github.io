/*  Who the eight strategies ARE, in one place.
 *
 *  The chart, the cards and the correlation matrix all label the same legs, in
 *  the same order, with the same colours. Keeping that in one module is what
 *  stops "Strategy E" meaning one thing in the legend and another in the
 *  matrix — which is exactly the bug that reordering the matrix fixed.
 */
import data from "@/data/portfolio99.json";

export type Stats = {
  from: string;
  to: string;
  years: number;
  return_pct: number;
  cagr_pct: number;
  max_dd_pct: number;
  calmar: number | null;
  sharpe: number | null;
} | null;

export type Leg = {
  symbol: string;
  family: string;
  scale: number;
  n_trades: number;
  stats: Stats;
  /** Metrics per window SELECTION, keyed by the visible band keys joined
      with "+" in band order. */
  by: Record<string, Stats>;
  /** Cumulative dollars contributed, index-for-index with `curve`. */
  series: number[];
  /** Recent behaviour against prior behaviour — Strategy Lab's Concerns
      panel, pointed at the backtest instead of a live account. */
  health: {
    split: string;
    before: HealthMetrics;
    after: HealthMetrics;
    flags: { metric: string; ratio: number; level: Level }[];
    verdict: Level;
  } | null;
  /** Gross, what the broker took, and the net that is plotted — all on the
      site's $10k fixed-size basis. */
  cost: {
    gross: number;
    commission: number;
    swap: number;
    net: number;
    commission_per_side: number;
    n_trades: number;
    recon_max_err: number | null;
  } | null;
};

export type Level = "ok" | "warn" | "critical";

export type HealthMetrics = {
  n_trades: number;
  net_pnl: number;
  win_rate_pct: number;
  profit_factor: number | null;
  sharpe: number;
  max_dd_pct: number;
  longest_lose_streak: number;
  avg_days_between_trades: number | null;
};

export const LEGS = data.legs as Leg[];

/*  Eight lines need eight hues that survive a dark background and sit apart
    from each other; the five-slot chart palette cannot carry it alone.      */
export const LEG_HUE = [
  "#00c2ff", "#cb3cff", "#05c168", "#ff5a65",
  "#ffb02e", "#8b7bff", "#2ee6c5", "#ff7ac3",
];
export const hueOf = (i: number) => LEG_HUE[i % LEG_HUE.length];

/*  The strategies are deliberately ANONYMOUS — the edge is the asset, not the
    letter — but the market is the half a reader needs to judge the mix, and it
    is spelled the way a reader says it, not the way the broker tickets it.  */
const MARKET: Record<string, string> = {
  USTEC: "NASDAQ",
  DE40: "Germany 40",
  XAUUSD: "Gold",
  USDJPY: "USDJPY",
  BTCUSD: "Bitcoin",
};
const LETTERS = "ABCDEFGH";

export const letterOf = (i: number) => LETTERS[i] ?? String(i + 1);
export const marketOf = (leg: Leg) => MARKET[leg.symbol] ?? leg.symbol;
export const legName = (i: number, leg: Leg) =>
  `Strategy ${letterOf(i)} on ${marketOf(leg)}`;
