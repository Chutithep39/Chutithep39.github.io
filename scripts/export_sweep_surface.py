"""Export one real parameter sweep as a 3-D surface for the home page.

WHY THIS SWEEP. A US30 long-only sweep, 15,456 configurations over a dense
23 x 20 grid of two parameters. It is NOT one of the deployed strategies — the
site shows method, not the live edges — and it is the clearest example on hand
of the thing the section is about: a broad raised region sitting next to an
isolated high cell.

WHAT IS PLOTTED. For each (x, y) cell, the BEST Calmar reachable at that
coordinate across every other parameter. That is the honest reading of a sweep
heatmap: the question is "how good can this corner of the grid get", not "how
good is one arbitrary config inside it".

Calmar follows the lab's own formula (`metrics.calmar_dollar`): annualised
dollar return / worst drawdown in dollars.

WHAT IS MARKED, and by what rule — both computed from the IN-SAMPLE grid,
because in-sample is what a search is actually choosing from:

  PLATEAU  the largest 4-connected group of cells that clear the 75th
           percentile TOGETHER WITH almost all of their neighbours. Pick from
           here: every cell in it is surrounded by cells that also work, so
           being slightly wrong about a parameter costs little.

  PEAK     a cell in the top 8% whose neighbours average less than 55% of it.
           Avoid: a single coordinate that worked with nothing holding it up.
           One step off and the result is gone.

ANONYMISED. The axis values are the parameters of a real strategy, so the
payload carries grid INDICES only — no parameter names, no values, no symbol.

    python scripts/export_sweep_surface.py
"""

from __future__ import annotations

import datetime as dt
import glob
import json
import pathlib
import sqlite3
import sys

import numpy as np
import pandas as pd

LAB = pathlib.Path(r"d:/01.Documents/11.Trading Career/Strategy Lab")
OUT = pathlib.Path(__file__).resolve().parent.parent / "src" / "data" / "sweep-surface.json"

SWEEP_NAME = "sweep_20260428_230103__M1"
SWEEP_SYMBOL = "US30"
AX, AY = "exit_min", "sma_period"

#  A cell with a handful of trades can post any Calmar at all. These floors are
#  about having a measurement, not about filtering for a good one.
MIN_IS_TRADES = 100
MIN_OOS_TRADES = 30

PLATEAU_PCT = 75   # a cell "works" at or above this percentile of the grid
PEAK_PCT = 92      # a cell is a spike candidate at or above this one
PEAK_RATIO = 0.55  # ...and only if its neighbours average less than this x it

DAYS_PER_YEAR = 365.25


def calmar(net: pd.Series, dd: pd.Series, years: float) -> pd.Series:
    """Annualised $ return / max DD $ — `metrics.calmar_dollar`, vectorised."""
    return (net / years) / dd


def main() -> None:
    db = LAB / "data" / "lab.sqlite"
    if not db.exists():
        sys.exit(f"lab database not found: {db}")

    con = sqlite3.connect(str(db))
    row = con.execute(
        "select date_from, date_to, oos_cutoff, results_dir, configs_total"
        "  from sweeps where name = ? and symbol = ?",
        (SWEEP_NAME, SWEEP_SYMBOL),
    ).fetchone()
    if not row:
        sys.exit(f"sweep {SWEEP_NAME!r} / {SWEEP_SYMBOL} is not in the lab database")
    d_from, d_to, cutoff, results_dir, configs = row

    is_years = (dt.date.fromisoformat(cutoff) - dt.date.fromisoformat(d_from)).days / DAYS_PER_YEAR
    oos_years = (dt.date.fromisoformat(d_to) - dt.date.fromisoformat(cutoff)).days / DAYS_PER_YEAR

    files = sorted(glob.glob(str(LAB / results_dir / "*.parquet")))
    if not files:
        sys.exit(f"no result chunks under {results_dir}")

    cols = [
        AX, AY,
        "is_net_profit", "is_max_dd_abs", "is_total_trades",
        "oos_net_profit", "oos_max_dd_abs", "oos_total_trades",
    ]
    df = pd.concat([pd.read_parquet(f, columns=cols) for f in files], ignore_index=True)
    scanned = len(df)

    df = df[
        (df.is_total_trades >= MIN_IS_TRADES)
        & (df.oos_total_trades >= MIN_OOS_TRADES)
        & (df.is_max_dd_abs > 0)
        & (df.oos_max_dd_abs > 0)
    ]
    df = df.assign(
        isc=calmar(df.is_net_profit, df.is_max_dd_abs, is_years),
        ooc=calmar(df.oos_net_profit, df.oos_max_dd_abs, oos_years),
    )

    cell = df.groupby([AX, AY])[["isc", "ooc"]].max()
    xs = sorted(df[AX].unique().tolist())
    ys = sorted(df[AY].unique().tolist())
    xi = {v: i for i, v in enumerate(xs)}
    yi = {v: i for i, v in enumerate(ys)}
    nx, ny = len(xs), len(ys)

    z_is = np.full((ny, nx), np.nan)
    z_oos = np.full((ny, nx), np.nan)
    for (x, y), r in cell.iterrows():
        z_is[yi[y]][xi[x]] = r.isc
        z_oos[yi[y]][xi[x]] = r.ooc

    vals = z_is[~np.isnan(z_is)]
    t_plateau = float(np.percentile(vals, PLATEAU_PCT))
    t_peak = float(np.percentile(vals, PEAK_PCT))

    def neighbours(i: int, j: int) -> list[tuple[int, int]]:
        return [
            (a, b)
            for a, b in ((i - 1, j), (i + 1, j), (i, j - 1), (i, j + 1))
            if 0 <= a < nx and 0 <= b < ny and not np.isnan(z_is[b][a])
        ]

    #  PLATEAU — a cell only qualifies if its NEIGHBOURHOOD works too. One
    #  neighbour is allowed to fall short so the region can have an edge;
    #  requiring all of them shrinks every plateau to its own interior.
    eligible = set()
    for j in range(ny):
        for i in range(nx):
            z = z_is[j][i]
            if np.isnan(z) or z < t_plateau:
                continue
            nb = neighbours(i, j)
            if len(nb) < 2:
                continue
            if sum(z_is[b][a] >= t_plateau for a, b in nb) >= max(2, len(nb) - 1):
                eligible.add((i, j))

    seen: set[tuple[int, int]] = set()
    plateau: list[tuple[int, int]] = []
    for start in eligible:
        if start in seen:
            continue
        stack, comp = [start], []
        while stack:
            node = stack.pop()
            if node in seen or node not in eligible:
                continue
            seen.add(node)
            comp.append(node)
            stack.extend(neighbours(*node))
        if len(comp) > len(plateau):
            plateau = comp

    #  CONSISTENCY — does the region still rank well on years it never saw?
    #  Expressed as a RANK inside the held-out grid, not as a raw Calmar: the
    #  two windows are different lengths and different markets, so "0.57 became
    #  1.57" says less than "it is still in the top quartile of its own grid".
    oos_vals = z_oos[~np.isnan(z_oos)]
    oos_q75 = float(np.percentile(oos_vals, 75))

    def oos_rank(i: int, j: int) -> int:
        return int(round(float((oos_vals < z_oos[j][i]).mean() * 100)))

    #  PEAK — high, and unsupported by anything around it.
    peaks = []
    for j in range(ny):
        for i in range(nx):
            z = z_is[j][i]
            if np.isnan(z) or z < t_peak:
                continue
            nb = neighbours(i, j)
            if not nb:
                continue
            around = float(np.mean([z_is[b][a] for a, b in nb]))
            if around < PEAK_RATIO * z:
                peaks.append({
                    "i": i, "j": j,
                    "is": round(float(z), 2),
                    "around": round(around, 2),
                    "oos": round(float(z_oos[j][i]), 2),
                    "oos_rank": oos_rank(i, j),
                })
    peaks.sort(key=lambda p: -p["is"])

    def stats(cells: list[tuple[int, int]]) -> dict:
        if not cells:
            return {}
        a = [float(z_is[j][i]) for i, j in cells]
        b = [float(z_oos[j][i]) for i, j in cells]
        return {
            "n": len(cells),
            "is_mean": round(float(np.mean(a)), 2),
            "is_min": round(float(np.min(a)), 2),
            "oos_mean": round(float(np.mean(b)), 2),
            "oos_min": round(float(np.min(b)), 2),
            "oos_top_quartile": int(sum(v >= oos_q75 for v in b)),
            "oos_rank_mean": int(round(float(np.mean([oos_rank(i, j) for i, j in cells])))),
        }

    def grid(m):
        return [[None if np.isnan(v) else round(float(v), 4) for v in r] for r in m]

    payload = {
        "generated": dt.date.today().isoformat(),
        "configs": int(configs),
        "cells": int(len(cell)),
        "scanned": int(scanned),
        "nx": nx,
        "ny": ny,
        "windows": {
            "is": {"from": d_from, "to": cutoff, "years": round(is_years, 2)},
            "oos": {"from": cutoff, "to": d_to, "years": round(oos_years, 2)},
        },
        "z": {"is": grid(z_is), "oos": grid(z_oos)},
        "plateau": {
            "cells": [[i, j] for i, j in sorted(plateau)],
            "threshold": round(t_plateau, 2),
            **stats(plateau),
        },
        "peaks": peaks,
        "oos_q75": round(oos_q75, 2),
    }

    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.name}  ({OUT.stat().st_size / 1024:.0f} KB)")
    print(f"  grid {nx}x{ny}, {len(cell)} measured cells of {scanned} configs")
    print(f"  plateau n={payload['plateau'].get('n')} "
          f"IS mean {payload['plateau'].get('is_mean')} min {payload['plateau'].get('is_min')} "
          f"| OOS mean {payload['plateau'].get('oos_mean')} min {payload['plateau'].get('oos_min')}")
    for p in peaks:
        print(f"  peak at ({p['i']},{p['j']})  IS {p['is']} vs neighbours {p['around']}"
              f"  -> OOS {p['oos']} (rank {p['oos_rank']})")


if __name__ == "__main__":
    main()
