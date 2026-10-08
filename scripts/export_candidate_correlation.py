"""The candidate against the book it would have to join.

    python scripts/export_candidate_correlation.py

Nine legs: the eight already in the portfolio, plus the dip-buy rule this
write-up tests. Same construction as the matrix on the results page — Pearson
on daily P&L, upper triangle over all days, lower triangle over the portfolio's
worst 20% of days.

Correlation is scale-invariant, so how the candidate is sized does not matter
here; it is given the same $10k base as the book legs purely so the daily
series line up.

⚠ The worst-20% days are the BOOK's worst days, not the combined book's. The
question being asked is whether adding this leg doubles the risk already
carried, and that is decided on the days the existing book was bleeding.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sqlite3
import sys
from datetime import date

import numpy as np
import pandas as pd

LAB = pathlib.Path(r"d:/01.Documents/11.Trading Career/Strategy Lab")
HERE = pathlib.Path(__file__).resolve().parent.parent
OUT = HERE / "src" / "data" / "candidate-correlation.json"
sys.path.insert(0, str(LAB / "backend"))

from app.services import portfolio_sim as PS  # noqa: E402
from app.services import ea_profiles_service as EAP  # noqa: E402

PORTFOLIO = "99.Resume Portfolio"
START = 10000.0
CANDIDATE = "Dip buy on NASDAQ"
DD_QUANTILE = 0.20


def force_engine_mode(through: str) -> None:
    """Same override the portfolio export uses — see its docstring."""
    original = EAP.get

    def patched(pid: str):
        p = dict(original(pid))
        if p.get("engine_version"):
            p["calc_mode"] = "engine"
            p["date_to"] = through
        return p

    EAP.get = patched


def book_daily() -> tuple[pd.DataFrame, list[dict]]:
    conn = sqlite3.connect(LAB / "data" / "lab.sqlite")
    conn.row_factory = sqlite3.Row
    pid = next(r["id"] for r in conn.execute("select id, name from portfolios")
               if PORTFOLIO.lower() in (r["name"] or "").lower())
    members = [dict(r) for r in conn.execute(
        """select m.profile_id, m.scale, p.symbol, p.family
           from portfolio_members m join ea_profiles p on p.id = m.profile_id
           where m.portfolio_id = ? order by m.sort_order""", (pid,))]
    ids = sorted(m["profile_id"] for m in members)
    #  Matches the site export's half-size book. Correlation is scale-
    #  invariant so this changes nothing here, but keeping the two scripts on
    #  one basis stops a future reader having to check whether it mattered.
    scales = {m["profile_id"]: float(m["scale"] or 0.0) * 0.5 for m in members}

    idx, t, ret, _ = PS._merged(ids)
    pnl = np.maximum(np.array([scales[ids[i]] for i in idx]) * ret, -0.99) * START
    frame = pd.DataFrame({"t": pd.to_datetime(t), "k": idx, "p": pnl})
    wide = (frame.pivot_table(index=frame["t"].dt.normalize(), columns="k",
                              values="p", aggfunc="sum")
            .reindex(columns=range(len(ids))).fillna(0.0))
    #  Merged-stream order is the SORTED id list; the site labels legs in
    #  member order. Reorder here or Strategy A names the wrong row.
    order = [ids.index(m["profile_id"]) for m in members]
    wide = wide.iloc[:, order]
    wide.columns = [f"{chr(65 + i)}" for i in range(len(members))]
    return wide, members


def candidate_daily() -> pd.Series:
    """Daily P&L of the dip-buy rule, on the same $10k base."""
    bt = json.loads((HERE / "src" / "data" / "backtest.json").read_text("utf-8"))
    rows = [(pd.Timestamp(p["d"]), p["v"]) for p in bt["curve"] if p["d"]]
    eq = pd.Series([v for _, v in rows], index=[d for d, _ in rows])
    #  The curve is cumulative percent on a 100 base; its daily change in
    #  dollars is what the other legs are expressed in.
    step = eq.diff()
    step.iloc[0] = eq.iloc[0] - 100.0
    return (step / 100.0 * START).groupby(level=0).sum()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--through", default=date.today().isoformat())
    args = ap.parse_args()
    force_engine_mode(args.through)

    book, members = book_daily()
    cand = candidate_daily()

    #  The candidate trades perhaps fifteen days a year; every other day it is
    #  flat, and flat is a real result. Union the calendars and fill zero
    #  rather than dropping the days it sat out, which would correlate it only
    #  against the days it happened to be active.
    idx = book.index.union(cand.index)
    wide = book.reindex(idx).fillna(0.0)
    wide[CANDIDATE] = cand.reindex(idx).fillna(0.0)

    worst = wide[book.columns].sum(axis=1)
    bad = worst <= worst.quantile(DD_QUANTILE)

    def matrix(frame: pd.DataFrame) -> list:
        m = frame.corr().to_numpy()
        return [[None if np.isnan(v) else round(float(v), 2) for v in row]
                for row in m]

    cols = list(wide.columns)
    labels = [f"{chr(65 + i)} {m['symbol']}" for i, m in enumerate(members)]
    labels.append(CANDIDATE)

    full = matrix(wide)
    dd = matrix(wide[bad])
    k = len(cols) - 1
    pairs_full = [full[k][j] for j in range(k)]
    pairs_dd = [dd[k][j] for j in range(k)]

    payload = {
        "generated": date.today().isoformat(),
        "labels": labels,
        "candidate_index": k,
        "n_days": int(len(wide)),
        "n_days_dd": int(bad.sum()),
        "dd_quantile_pct": int(DD_QUANTILE * 100),
        "matrix": full,
        "matrix_dd": dd,
        "candidate_mean": round(float(np.nanmean(pairs_full)), 3),
        "candidate_max": round(float(np.nanmax(pairs_full)), 2),
        "candidate_dd_mean": round(float(np.nanmean(pairs_dd)), 3),
        "candidate_dd_max": round(float(np.nanmax(pairs_dd)), 2),
    }
    pathlib.Path(args.out).write_text(json.dumps(payload, separators=(",", ":")),
                                      encoding="utf-8")
    print(f"days {len(wide)}  dd-days {int(bad.sum())}")
    for j in range(k):
        print(f"  {labels[j]:22s} all {pairs_full[j]:+.2f}   worst-20% {pairs_dd[j]:+.2f}")
    print(f"  mean {payload['candidate_mean']:+.3f}   dd-mean "
          f"{payload['candidate_dd_mean']:+.3f}   max {payload['candidate_max']:+.2f}")


if __name__ == "__main__":
    main()
