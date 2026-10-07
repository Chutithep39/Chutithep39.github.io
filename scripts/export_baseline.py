"""The baseline a conditional edge has to beat: what an ordinary day looks like.

Builds the distribution of DAILY OPEN-TO-CLOSE returns for the four index CFDs
the study uses, straight from the same one-minute lake the engine reads.

    python scripts/export_baseline.py

Open-to-close, not close-to-close: close-to-close folds the previous night's
gap into today's number, and the whole study is about a move that happens
inside a day. Broker time throughout — the broker's day runs 01:00 to 23:59
server, which is not the calendar day in any other timezone.

⚠ This writes the HISTOGRAM, not the raw series. A page does not need 8,700
daily returns to show their shape, and shipping them would be shipping the
lake.
"""
from __future__ import annotations

import argparse
import json
import pathlib
from datetime import date

import numpy as np
import pandas as pd

LAB = pathlib.Path(r"d:/01.Documents/11.Trading Career/Strategy Lab")
HERE = pathlib.Path(__file__).resolve().parent.parent
OUT = HERE / "src" / "data" / "baseline.json"

SYMBOLS = ["USTEC", "US500", "US30", "DE40"]
#  The study's own window. Starting later than the lake does would quietly
#  change which days are in the baseline but not which are in the test.
#  THE ANALYSIS WINDOW IS THE FITTED HALF ONLY.
#
#  It used to run to 2026, which meant the 2% threshold was chosen on data
#  that included the years the backtest then calls "held out". The hold-out was
#  not held out at all — it had already been read once, at the moment the
#  threshold was picked. Everything on this page that informs a CHOICE stops at
#  the split; only the backtest is allowed to see past it.
FROM, TO = "2018-01-01", "2023-12-31"

#  Bin edges in per cent. Fixed rather than derived, so re-running on fresher
#  data cannot silently change the shape of the chart by re-binning it.
LO, HI, STEP = -5.0, 5.0, 0.25


def day_returns(symbol: str, close_hour: int = 24) -> pd.Series:
    """One open-to-close return per broker day, in per cent.

    `close_hour` 24 is the full broker day, 01:00-23:59 — the TRIGGER, which is
    only known once the day has finished and is therefore free to use all of
    it. `close_hour` 22 is the window the strategy actually trades and exits
    in, and it is what the OUTCOME has to be measured over: scoring the bounce
    to 23:59 would credit the trade with an hour it was already flat for.
    """
    px = pd.read_parquet(LAB / "data" / "raw" / f"{symbol}.parquet",
                         columns=["open", "close"])
    px.index = pd.to_datetime(px.index).tz_localize(None)
    px = px.loc[FROM:TO]
    #  The 00:00 hour is the rollover and belongs to no session anyone trades.
    px = px[(px.index.hour >= 1) & (px.index.hour < close_hour)]
    g = px.groupby(px.index.normalize())
    out = (g["close"].last() - g["open"].first()) / g["open"].first() * 100.0
    #  A broker day with only a handful of minutes is a holiday stub, not a
    #  session; its "return" is noise on a thin book.
    keep = g.size() >= 120
    return out[keep].dropna()


#  Today's move, bucketed, against what the NEXT day did. This is the
#  hypothesis drawn directly: if a red day is followed by a green one, the line
#  slopes down from left to right and does it without being told to.
#
#  1% buckets, not the 0.25% the histogram uses. At 0.25% the tails hold six
#  days each and the bucket means alternate sign on noise; at 1% the thinnest
#  bucket still holds nineteen, which is few enough to need an error bar and
#  enough to mean something.
COND_STEP = 1.0


def conditional(symbol: str) -> dict:
    #  Trigger on the full day, score on the tradeable window.
    r = day_returns(symbol)
    df = pd.DataFrame({"today": r, "next": day_returns(symbol, 22).shift(-1)}).dropna()
    uncond = float(df["next"].mean())
    #  OPEN-ENDED ENDS. Clipping into [-5, +5] put every day worse than -5%
    #  into the -5..-4 bucket while the label said otherwise — 9 days down to
    #  -10.6% and 10 days up to +12.4% were counted but mis-described. The
    #  outer edges are infinite so the bucket is what its label says.
    edges = np.concatenate([[-np.inf], np.arange(LO + 1, HI, COND_STEP), [np.inf]])
    lab = pd.cut(df["today"], bins=edges)
    g = df.groupby(lab, observed=True)["next"]
    bins = []
    for interval, sub in g:
        n = int(sub.count())
        if n < 2:
            continue
        se = float(sub.std(ddof=1) / np.sqrt(n))
        left, right = float(interval.left), float(interval.right)
        bins.append({
            #  null = unbounded on that side, so the chart can label it "<=".
            "lo": None if np.isinf(left) else round(left, 2),
            "hi": None if np.isinf(right) else round(right, 2),
            "n": n,
            "mean_pct": round(float(sub.mean()), 3),
            #  Standard error, so the chart can show how much of each bucket is
            #  sample size rather than signal.
            "se_pct": round(se, 3),
            #  Against the unconditional day, which is the only baseline the
            #  study ever cares about.
            "t_vs_uncond": round(float((sub.mean() - uncond) / se), 2),
        })
    return {
        "step": COND_STEP,
        "unconditional_mean_pct": round(uncond, 4),
        "n_pairs": int(len(df)),
        "bins": bins,
    }


#  The thresholds the study actually trades on, each tested against EVERY
#  OTHER DAY rather than against zero. "Better than nothing" is not the claim;
#  "better than an ordinary day" is.
THRESHOLDS = (-1.0, -1.5, -2.0, -2.5)


def significance(symbol: str) -> list:
    """Welch t on the next day's MEAN, and a two-proportion z on its HIT RATE.

    ONE-SIDED, both of them. The hypothesis is directional and was written
    before the data was touched — it says the day after a big fall is BETTER
    than an ordinary day, not merely different from it. A two-sided test
    answers a question nobody asked and spends half its power doing it.
    (This started out two-sided, which doubled every p-value here and made the
    hit-rate result look insignificant when it is not.)

      H0: mean/up-rate after the fall <= every other day
      H1: mean/up-rate after the fall  > every other day

    Both tests, because they answer different questions — how big the bounce
    is, and how often it happens — and reporting only the one that passes
    would be choosing the test after seeing the answer.
    """
    from scipy import stats

    r = day_returns(symbol)
    df = pd.DataFrame({"today": r, "next": day_returns(symbol, 22).shift(-1)}).dropna()
    out = []
    for thr in THRESHOLDS:
        a = df.loc[df["today"] <= thr, "next"]
        b = df.loc[df["today"] > thr, "next"]
        t, p = stats.ttest_ind(a, b, equal_var=False, alternative="greater")
        up_a, up_b = float((a > 0).mean()), float((b > 0).mean())
        pool = float(((a > 0).sum() + (b > 0).sum()) / (len(a) + len(b)))
        se = np.sqrt(pool * (1 - pool) * (1 / len(a) + 1 / len(b)))
        z = (up_a - up_b) / se
        out.append({
            "threshold": thr,
            "n_after": int(len(a)),
            "n_other": int(len(b)),
            "mean_after_pct": round(float(a.mean()), 3),
            "mean_other_pct": round(float(b.mean()), 3),
            "t": round(float(t), 2),
            "p_mean": round(float(p), 4),
            "up_after_pct": round(up_a * 100, 1),
            "up_other_pct": round(up_b * 100, 1),
            "z": round(float(z), 2),
            "p_hit": round(float(1 - stats.norm.cdf(z)), 4),
        })
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()

    edges = np.round(np.arange(LO, HI + STEP, STEP), 4)
    series = {}
    for sym in SYMBOLS:
        r = day_returns(sym)
        counts, _ = np.histogram(r.clip(LO, HI - 1e-9), bins=edges)
        series[sym] = {
            "n_days": int(len(r)),
            "from": r.index.min().strftime("%Y-%m-%d"),
            "to": r.index.max().strftime("%Y-%m-%d"),
            "mean_pct": round(float(r.mean()), 4),
            "median_pct": round(float(r.median()), 4),
            "sd_pct": round(float(r.std(ddof=1)), 3),
            "up_rate_pct": round(float((r > 0).mean() * 100.0), 1),
            "p05_pct": round(float(r.quantile(0.05)), 3),
            "p95_pct": round(float(r.quantile(0.95)), 3),
            "worst_pct": round(float(r.min()), 2),
            "best_pct": round(float(r.max()), 2),
            #  Share of days at or below each study threshold — how rare the
            #  trigger actually is, which decides whether the edge is tradeable
            #  at all or merely true.
            "tail_share_pct": {
                str(t): round(float((r <= t).mean() * 100.0), 2)
                for t in (-1.0, -1.5, -2.0, -2.5)
            },
            "counts": [int(c) for c in counts],
        }
        series[sym]["conditional"] = conditional(sym)
        series[sym]["significance"] = significance(sym)
        print(f"{sym:6s} n={len(r):5d}  mean {r.mean():+.4f}%  median "
              f"{r.median():+.4f}%  sd {r.std(ddof=1):.3f}  up "
              f"{(r > 0).mean() * 100:.1f}%  <=-2%: "
              f"{(r <= -2.0).mean() * 100:.2f}%")

    payload = {
        "generated": date.today().isoformat(),
        "basis": "daily open-to-close, broker time, 01:00-23:59",
        "bin_lo": LO,
        "bin_hi": HI,
        "bin_step": STEP,
        "symbols": series,
    }
    p = pathlib.Path(args.out)
    p.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {p.name} ({p.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
