/*  THE FIGURES THE PROSE QUOTES, READ FROM THE DATA RATHER THAN TYPED IN.
 *
 *  Copy across this site said "eight strategies", "five instruments", "$10k",
 *  "ten weeks" and "eight years" as literals. Every one of those moves: a
 *  member joins the portfolio, an instrument is added, the live window gets a
 *  day longer every night. The nightly refresh re-exports the JSON and the
 *  sentences beside it would have gone on saying whatever was true the day
 *  they were written — which is the specific way a page about being checkable
 *  stops being checkable.
 *
 *  So anything a reader could cross-check against a number on the same screen
 *  is derived here, once, and imported. Things that are NOT data — seven years
 *  of analytics experience, the broker's commission schedule — stay as prose
 *  where they belong.
 */
import data from "@/data/portfolio99.json";

type Stats = {
  from: string;
  to: string;
  years: number;
  n_trades: number;
  return_pct: number;
  cagr_pct: number;
  max_dd_pct: number;
  calmar: number | null;
  sharpe: number | null;
};
type Band = { key: string; label: string; stats: Stats };

const BANDS = data.bands as Band[];
const LIVE = BANDS.find((b) => b.key === "recent")!.stats;

/** How many strategies share the account. */
export const MEMBERS = data.members as number;
/** How many instruments they trade between them. */
export const INSTRUMENTS = (data.assets as string[]).length;
/** The capital every dollar figure on the site is drawn against. */
export const START = data.start_balance as number;

/** Whole span the backtest covers, first band open to last band close. */
export const SPAN_YEARS =
  (new Date(BANDS[BANDS.length - 1].stats.to).getTime() -
    new Date(BANDS[0].stats.from).getTime()) /
  (365.25 * 24 * 3600 * 1000);

export const LIVE_TRADES = LIVE.n_trades;
export const LIVE_MONTHS = LIVE.years * 12;
export const LIVE_WEEKS = (LIVE.years * 365.25) / 7;

/*  Small counts read as words in a sentence and as digits in a table. Past
    twelve, words stop helping — "fourteen thousand and three" is not a
    sentence anyone wants.                                                 */
const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve",
];
export const word = (n: number) =>
  Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n] : String(n);

/** "$10k" where it is round, "$12,500" where it is not. */
export const money = (n: number) =>
  n >= 1000 && n % 1000 === 0
    ? `$${n / 1000}k`
    : `$${n.toLocaleString("en-US")}`;

/*  A duration a person would say out loud. Ten weeks while it is weeks, then
    months, then years — and "eight and a half" rather than "8.5" because the
    sentences these land in are prose.                                      */
export function spokenDuration(years: number): string {
  const weeks = (years * 365.25) / 7;
  if (weeks < 14) return `${word(Math.round(weeks))} weeks`;
  const months = years * 12;
  if (months < 22) return `${word(Math.round(months))} months`;
  const whole = Math.floor(years);
  const rest = years - whole;
  if (rest >= 0.25 && rest < 0.75) return `${word(whole)} and a half years`;
  return `${word(Math.round(years))} years`;
}

export const LIVE_SPOKEN = spokenDuration(LIVE.years);
export const SPAN_SPOKEN = spokenDuration(SPAN_YEARS);
