"""The rule, traded. Buy the day after a 2%+ fall, flat at the close.

    python scripts/export_backtest.py

Entry at the next broker day's open (01:00), exit at that day's 22:00 close.
Nothing held overnight, so no financing. Index CFDs carry no commission at
this broker, which makes the SPREAD the entire cost — and makes it easy to
show gross and net side by side.

Cost model: MT5 bars are BID. A long pays the ask to get in and receives the
bid to get out, so the round trip crosses the spread exactly once, charged at
the spread recorded on the entry minute. Using the day's average spread would
be cheaper and wrong; using the midnight-rollover figure would be the other
kind of wrong.

Sizing is FIXED: one unit per trade, returns added rather than compounded, so
the equity curve reads as edge and not as the order the good years arrived in.
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
OUT = HERE / "src" / "data" / "backtest.json"

SYMBOL = "USTEC"
POINT = 0.01            # USTEC point size, from the broker's symbol spec
THRESHOLD = -2.0        # chosen off the significance table, before this ran
FROM, TO = "2018-01-01", "2026-10-07"
SPLIT = "2024-01-01"    # fitted / held out
TRADING_DAYS = 252


def sessions() -> pd.DataFrame:
    """One row per broker day: open, close, and the spread at the open."""
    px = pd.read_parquet(LAB / "data" / "raw" / f"{SYMBOL}.parquet",
                         columns=["open", "close", "spread"])
    px.index = pd.to_datetime(px.index).tz_localize(None)
    px = px.loc[FROM:TO]
    #  01:00-22:00 broker. The exit is 22:00 and NOT 23:00 — that last hour is
    #  measurably negative on this instrument, and letting it in would flatter
    #  every number below.
    px = px[(px.index.hour >= 1) & (px.index.hour < 22)]
    g = px.groupby(px.index.normalize())
    df = pd.DataFrame({
        "open": g["open"].first(),
        "close": g["close"].last(),
        "spread_open": g["spread"].first(),
        "bars": g.size(),
    })
    #  A day with a handful of minutes is a holiday stub, not a session.
    return df[df["bars"] >= 120].drop(columns="bars")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()

    s = sessions()
    s["ret_pct"] = (s["close"] - s["open"]) / s["open"] * 100.0
    #  One full spread, at the entry minute, as a percentage of the entry price.
    s["cost_pct"] = s["spread_open"] * POINT / s["open"] * 100.0

    #  The signal is YESTERDAY's close-vs-open, so the trade is taken on a day
    #  whose own return is not yet known. Shifted, not aligned by hand.
    sig = s["ret_pct"].shift(1) <= THRESHOLD
    t = s[sig].copy()
    t["gross_pct"] = t["ret_pct"]
    t["net_pct"] = t["gross_pct"] - t["cost_pct"]

    def window(df: pd.DataFrame, label: str, lo: str, hi: str | None) -> dict:
        w = df.loc[lo:hi] if hi else df.loc[lo:]
        if len(w) < 2:
            return {}
        net = w["net_pct"].to_numpy()
        eq = 100.0 + np.cumsum(net)          # fixed size, start at 100
        peak = np.maximum.accumulate(eq)
        dd = (peak - eq) / peak * 100.0
        years = (w.index[-1] - w.index[0]).days / 365.25
        #  Per-trade Sharpe scaled by trades per year — this fires a few times
        #  a quarter, so a daily-Sharpe convention would be measuring mostly
        #  days the strategy was flat.
        per_year = len(w) / max(years, 0.25)
        sharpe = (net.mean() / net.std(ddof=1) * np.sqrt(per_year)
                  if net.std(ddof=1) > 0 else None)
        return {
            "label": label,
            "from": w.index[0].strftime("%Y-%m-%d"),
            "to": w.index[-1].strftime("%Y-%m-%d"),
            "years": round(years, 2),
            "n_trades": int(len(w)),
            "gross_mean_pct": round(float(w["gross_pct"].mean()), 3),
            "cost_mean_pct": round(float(w["cost_pct"].mean()), 3),
            "net_mean_pct": round(float(net.mean()), 3),
            "win_rate_pct": round(float((net > 0).mean() * 100), 1),
            "total_pct": round(float(net.sum()), 1),
            "per_year_pct": round(float(net.sum() / max(years, 0.25)), 1),
            "max_dd_pct": round(float(dd.max()), 2),
            "sharpe": round(float(sharpe), 2) if sharpe else None,
            "best_pct": round(float(net.max()), 2),
            "worst_pct": round(float(net.min()), 2),
        }

    windows = [
        window(t, "Fitted", FROM, SPLIT),
        window(t, "Held out", SPLIT, None),
        window(t, "Full period", FROM, None),
    ]

    #  The curve the site draws: cumulative net, one point per trade, plus an
    #  opening point so the first trade has something to move from.
    eq = 100.0 + np.cumsum(t["net_pct"].to_numpy())
    curve = [{"d": None, "v": 100.0}] + [
        {"d": d.strftime("%Y-%m-%d"), "v": round(float(v), 2)}
        for d, v in zip(t.index, eq)
    ]

    payload = {
        "generated": date.today().isoformat(),
        "symbol": SYMBOL,
        "threshold_pct": THRESHOLD,
        "split": SPLIT,
        "basis": "fixed size, one unit per trade, net of one full spread",
        "windows": [w for w in windows if w],
        "curve": curve,
    }
    pathlib.Path(args.out).write_text(json.dumps(payload, separators=(",", ":")),
                                      encoding="utf-8")
    for w in windows:
        if w:
            print(f"  {w['label']:12s} {w['from']} -> {w['to']}  n={w['n_trades']:3d}  "
                  f"gross {w['gross_mean_pct']:+.3f}%  cost {w['cost_mean_pct']:.3f}%  "
                  f"net {w['net_mean_pct']:+.3f}%  win {w['win_rate_pct']:.1f}%  "
                  f"total {w['total_pct']:+.1f}%  maxDD {w['max_dd_pct']:.2f}%  "
                  f"Sharpe {w['sharpe']}")


if __name__ == "__main__":
    main()
