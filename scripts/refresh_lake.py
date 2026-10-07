"""Pull fresh M1 bars for exactly the symbols portfolio #99 trades.

Step one of the nightly refresh. The site's curve is only as recent as the
data lake the engine replays, so this runs BEFORE `export_portfolio.py`.

It calls Strategy Lab's OWN `data_download.refresh` rather than touching
parquet here: that function owns the incremental-append rule, the timestamp
convention (MT5 broker-local stored as UTC) and the self-heal on a corrupt
file. A second copy of that logic in the site's repo would drift from it.

⚠ Needs the MT5 terminal. MT5 is single-instance, so a tester pass or a
terminal already open can make this fail or hang — schedule it at a quiet hour.
"""
from __future__ import annotations

import argparse
import pathlib
import sqlite3
import sys

LAB = pathlib.Path(r"d:/01.Documents/11.Trading Career/Strategy Lab")
sys.path.insert(0, str(LAB / "backend"))

from app.services import data_download as DD  # noqa: E402


def symbols_of(portfolio: str) -> list[str]:
    conn = sqlite3.connect(LAB / "data" / "lab.sqlite")
    conn.row_factory = sqlite3.Row
    rows = [dict(r) for r in conn.execute("select id, name from portfolios")]
    hit = next((r for r in rows if r["id"] == portfolio), None)
    if hit is None:
        hits = [r for r in rows if portfolio.lower() in (r["name"] or "").lower()]
        if len(hits) != 1:
            raise SystemExit(f"{portfolio!r} matched {len(hits)} portfolios")
        hit = hits[0]
    return sorted({r[0] for r in conn.execute(
        """select distinct p.symbol from portfolio_members m
           join ea_profiles p on p.id = m.profile_id
           where m.portfolio_id = ?""", (hit["id"],))})


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--portfolio", default="99.Resume Portfolio")
    args = ap.parse_args()

    failed = []
    added = 0
    for sym in symbols_of(args.portfolio):
        try:
            #  `refresh` already prints its own one-line summary; this only
            #  adds the tally the caller is scheduling it for.
            r = DD.refresh(sym, "M1")
            added += int(r.get("appended") or 0)
        except Exception as exc:                      # noqa: BLE001
            #  One stale symbol must not stop the other four: a partial refresh
            #  still moves the curve, and the failure is printed, not swallowed.
            failed.append(sym)
            print(f"  {sym:8s} FAILED: {exc}")
    print(f"lake: +{added:,} bars across {len(symbols_of(args.portfolio))} symbols")
    if failed:
        raise SystemExit(f"refresh failed for: {', '.join(failed)}")


if __name__ == "__main__":
    main()
