"""Is the dip buy a plateau, or did 2% and 22:00 just get lucky?

    python scripts/export_dip_sweep.py

The write-up picks one threshold off a significance table and one exit time,
then shows a backtest of exactly that pair. A reader is entitled to ask
whether the result survives being slightly wrong about either — so this sweeps
both and ships the surface.

SAME RULES AS THE BACKTEST IT CHECKS (`export_backtest.py`): the signal is the
previous session's open-to-close return, shifted so a trade is taken on a day
whose own return is not yet known; entry is the next session's 01:00 open;
sizing is fixed, one unit per trade, returns added and not compounded; the
cost is one full spread charged at the spread recorded on the entry minute,
because MT5 bars are bid and the long round trip crosses the spread once.

WHAT IS SCORED, AND ON WHICH YEARS. Calmar — annualised return over worst
drawdown, the lab's own ranking metric — computed on the FITTED window only,
because that is the window the 2% threshold was chosen from. The held-out
years are exported alongside for the toggle but took no part in any choice.

Note the one real difference from the headline backtest: the exit hour is a
swept axis here, so the 22:00 column reproduces the published numbers and
every other column is a counterfactual.
"""
from __future__ import annotations

import json
import pathlib
from datetime import date

import numpy as np
import pandas as pd

LAB = pathlib.Path(r"d:/01.Documents/11.Trading Career/Strategy Lab")
HERE = pathlib.Path(__file__).resolve().parent.parent
OUT = HERE / "src" / "data" / "dip-sweep.json"

SYMBOL = "USTEC"
POINT = 0.01
#  TO follows the clock, not a literal — see export_backtest.py.
FROM, TO = "2018-01-01", date.today().isoformat()
SPLIT = "2024-01-01"

#  The two knobs the strategy actually has. Thresholds run past the chosen
#  -2.0 in both directions so the surface shows its shoulders, not just its
#  summit; exits cover the whole liquid afternoon into the close.
THRESHOLDS = [round(-0.75 - 0.25 * i, 2) for i in range(12)]   # -0.75 .. -3.50
EXIT_HOURS = list(range(14, 24))                               # 14:00 .. 23:00

MIN_TRADES = 25   # below this a Calmar is a story about four trades


def sessions(exit_hour: int) -> pd.DataFrame:
    """One row per broker day, closed at `exit_hour`."""
    px = PX[(PX.index.hour >= 1) & (PX.index.hour < exit_hour)]
    g = px.groupby(px.index.normalize())
    df = pd.DataFrame({
        "open": g["open"].first(),
        "close": g["close"].last(),
        "spread_open": g["spread"].first(),
        "bars": g.size(),
    })
    #  A day with a handful of minutes is a holiday stub, not a session.
    df = df[df["bars"] >= 120].drop(columns="bars")
    df["ret_pct"] = (df["close"] - df["open"]) / df["open"] * 100.0
    df["cost_pct"] = df["spread_open"] * POINT / df["open"] * 100.0
    return df


def calmar(net: np.ndarray, index: pd.DatetimeIndex) -> float | None:
    if len(net) < 2:
        return None
    eq = 100.0 + np.cumsum(net)
    peak = np.maximum.accumulate(eq)
    dd = float(((peak - eq) / peak * 100.0).max())
    years = (index[-1] - index[0]).days / 365.25
    if dd <= 0 or years <= 0.25:
        return None
    return float(net.sum() / years / dd)


PX = pd.read_parquet(LAB / "data" / "raw" / f"{SYMBOL}.parquet",
                     columns=["open", "close", "spread"])
PX.index = pd.to_datetime(PX.index).tz_localize(None)
PX = PX.loc[FROM:TO]


def main() -> None:
    nx, ny = len(THRESHOLDS), len(EXIT_HOURS)
    z_is = np.full((ny, nx), np.nan)
    z_oos = np.full((ny, nx), np.nan)
    n_is = np.zeros((ny, nx), dtype=int)

    for j, hour in enumerate(EXIT_HOURS):
        s = sessions(hour)
        #  The SIGNAL day is always the full 01:00-22:00 session, whatever the
        #  exit hour being tested. Letting the signal window move with the exit
        #  would change what "a 2% down day" means from column to column and
        #  the surface would be comparing two things at once.
        sig_ret = SIGNAL.reindex(s.index)
        for i, thr in enumerate(THRESHOLDS):
            take = sig_ret.shift(1) <= thr
            t = s[take.fillna(False)]
            if len(t) < MIN_TRADES:
                continue
            net = (t["ret_pct"] - t["cost_pct"]).to_numpy()
            fit = t.index < np.datetime64(SPLIT)
            if fit.sum() >= MIN_TRADES:
                z_is[j][i] = calmar(net[fit], t.index[fit])
                n_is[j][i] = int(fit.sum())
            if (~fit).sum() >= 10:
                z_oos[j][i] = calmar(net[~fit], t.index[~fit])

    #  THE CHOSEN CELL, found by coordinate rather than by searching for the
    #  best one — the whole point is that it was picked before this ran.
    ci = THRESHOLDS.index(-2.0)
    cj = EXIT_HOURS.index(22)

    def neighbours(i: int, j: int) -> list[tuple[int, int]]:
        return [(a, b) for a, b in ((i - 1, j), (i + 1, j), (i, j - 1), (i, j + 1))
                if 0 <= a < nx and 0 <= b < ny and not np.isnan(z_is[b][a])]

    vals = z_is[~np.isnan(z_is)]
    around = [z_is[b][a] for a, b in neighbours(ci, cj)]

    #  The plateau: every cell that clears the same bar as the chosen one does,
    #  reached from it without stepping over anything that fails. Stated as a
    #  rule so the region cannot be drawn to flatter the choice.
    bar = min(float(z_is[cj][ci]), float(np.percentile(vals, 70)))
    seen: set[tuple[int, int]] = set()
    stack = [(ci, cj)]
    while stack:
        node = stack.pop()
        if node in seen:
            continue
        i, j = node
        if np.isnan(z_is[j][i]) or z_is[j][i] < bar:
            continue
        seen.add(node)
        stack.extend(neighbours(i, j))
    plateau = sorted(seen)

    pv_is = [float(z_is[j][i]) for i, j in plateau]
    pv_oos = [float(z_oos[j][i]) for i, j in plateau if not np.isnan(z_oos[j][i])]

    def grid(m):
        return [[None if np.isnan(v) else round(float(v), 4) for v in r] for r in m]

    payload = {
        "generated": date.today().isoformat(),
        "metric": "Calmar",
        "basis": "fixed size, one unit per trade, net of one full spread",
        "x": {"label": "Fall that triggers the trade", "values": THRESHOLDS,
              "format": "pct"},
        "y": {"label": "Exit time, broker", "values": EXIT_HOURS,
              "format": "hour"},
        "nx": nx, "ny": ny,
        "windows": {
            "is": {"from": FROM, "to": SPLIT},
            "oos": {"from": SPLIT, "to": TO},
        },
        "z": {"is": grid(z_is), "oos": grid(z_oos)},
        "chosen": {
            "i": ci, "j": cj,
            "is": round(float(z_is[cj][ci]), 2),
            "oos": round(float(z_oos[cj][ci]), 2),
            "n_is": int(n_is[cj][ci]),
            "around": round(float(np.mean(around)), 2),
        },
        "plateau": {
            "cells": [[i, j] for i, j in plateau],
            "n": len(plateau),
            "bar": round(bar, 2),
            "is_min": round(min(pv_is), 2),
            "is_mean": round(float(np.mean(pv_is)), 2),
            "oos_min": round(min(pv_oos), 2) if pv_oos else None,
            "oos_mean": round(float(np.mean(pv_oos)), 2) if pv_oos else None,
        },
        "measured": int((~np.isnan(z_is)).sum()),
        "cells": int(nx * ny),
    }

    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.name}  ({OUT.stat().st_size / 1024:.0f} KB)")
    print(f"  grid {nx}x{ny}, {payload['measured']} cells measured")
    print(f"  chosen -2.0% / 22:00  IS {payload['chosen']['is']} "
          f"(neighbours {payload['chosen']['around']})  OOS {payload['chosen']['oos']} "
          f"on {payload['chosen']['n_is']} fitted trades")
    print(f"  plateau {payload['plateau']}")


#  The signal window is fixed at the published session so it means the same
#  thing in every column; built once, before the sweep.
SIGNAL = (lambda s: (s["close"] - s["open"]) / s["open"] * 100.0)(
    (lambda px: pd.DataFrame({
        "open": px.groupby(px.index.normalize())["open"].first(),
        "close": px.groupby(px.index.normalize())["close"].last(),
    }))(PX[(PX.index.hour >= 1) & (PX.index.hour < 22)])
)


if __name__ == "__main__":
    main()
