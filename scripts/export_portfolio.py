"""Snapshot a Strategy Lab portfolio into the site's static data.

    npm run sync            # default portfolio, default windows
    python scripts/export_portfolio.py --portfolio <id|name-fragment>

THIS IS A SNAPSHOT, NOT A LIVE FEED. The site ships a JSON file so it can be
deployed as static pages with no backend and no database access from the
internet. Change anything in the lab and the site keeps showing the old numbers
until this is re-run — that is the trade, and it is why the file records the
date it was generated.

It calls Strategy Lab's OWN `portfolio_sim._merged` rather than re-deriving the
combine, so the curve on the site is the curve in the tool. A second
implementation would drift, and a portfolio site that disagrees with the
research console is worse than no portfolio site.
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
OUT = HERE / "src" / "data" / "portfolio99.json"
sys.path.insert(0, str(LAB / "backend"))

from app.services import portfolio_sim as PS  # noqa: E402
from app.services import ea_profiles_service as EAP  # noqa: E402


def force_engine_mode(through: str) -> None:
    """Read every member as an ENGINE run through `through`, WITHOUT touching
    the lab.

    The members are stored `calc_mode="report"`: their trades come from an
    uploaded MT5 tester .html and therefore stop on the day that file was
    generated. A nightly export of those is a nightly export of the same frozen
    trades. Engine mode re-runs the member's own engine over the parquet lake
    instead, so the curve reaches whatever the lake reaches.

    The override is a monkeypatch on `get` rather than an UPDATE because the
    profile row is the provenance of `metrics_json` — rewriting `calc_mode`
    there would silently restate every number the console shows for this book.
    `member_stream` still pulls the .html's own inputs through `parity_gate`,
    so the engine runs the SAME config the report was produced with.
    """
    original = EAP.get

    def patched(pid: str):
        p = dict(original(pid))
        if p.get("engine_version"):
            p["calc_mode"] = "engine"
            #  Stored `date_to` is the report's last trade. Keeping it would
            #  re-freeze the curve at exactly the date this is meant to move.
            p["date_to"] = through
        return p

    EAP.get = patched


def closed_trades_only() -> None:
    """Publish only positions that actually closed.

    The engines book a position still open when the bars run out — MT5's
    tester does the same, and parity depends on it, so the engine is right to.
    But that last row is a FLOATING mark, priced at whatever minute the lake
    happens to end on, and the site presents realised results beside a live
    account. The 8 Oct USDJPY row carried `exit_reason="end_of_data"` at
    14:26 and +$74.65 that nobody had been paid.

    Filtered HERE and not in the engine: the lab still needs the open position
    booked to match the tester. This is a publishing rule, not a model change.
    """
    from app.services import portfolio_simulator as PSIM

    original = PSIM._run_strategy_trades

    def patched(*a, **k):
        tr = original(*a, **k)
        if tr is not None and len(tr) and "exit_reason" in tr.columns:
            open_rows = tr["exit_reason"].astype(str).eq("end_of_data")
            if open_rows.any():
                tr = tr[~open_rows]
        return tr

    PSIM._run_strategy_trades = patched

#  The three windows. Only the first was ever fitted; the rest are scored.
#  ⚠ The third is LABELLED "Live" at the owner's instruction, but its data is
#  the same backtest as the other two — no member stream here is live-traded
#  fills. If this page ever has to defend the label, that is the gap.
BANDS = [
    ("is", "In-sample", "2018-01-01", "2024-01-01"),
    ("oos", "Out-of-sample", "2024-01-01", "2026-08-01"),
    ("recent", "Live", "2026-08-01", None),
]


def resolve(conn: sqlite3.Connection, want: str) -> dict:
    rows = [dict(r) for r in conn.execute(
        "select id, name, start_balance, max_dd_pct from portfolios")]
    for r in rows:
        if r["id"] == want:
            return r
    hits = [r for r in rows if want.lower() in (r["name"] or "").lower()]
    if len(hits) == 1:
        return hits[0]
    if not hits:
        raise SystemExit(
            f"no portfolio matching {want!r}. Available:\n  "
            + "\n  ".join(f"{r['id']}  {r['name']}" for r in rows))
    raise SystemExit(
        f"{want!r} is ambiguous:\n  "
        + "\n  ".join(f"{r['id']}  {r['name']}" for r in hits))


def cost_breakdown(pid: str, scale: float, start: float, through: str,
                   window: tuple) -> dict | None:
    """What this member paid to trade, on the SAME basis as its line on the site.

    `member_stream` de-compounds each engine trade into `ret = pnl / balance_before`
    and the site re-sizes that onto $10k. Dividing the COST by the same
    `balance_before` puts both on one basis, so the figures here are what the
    site's own curve paid — not a ratio borrowed from a differently-sized run.

    Only one of the four engines returns a `gross_pnl` column, so cost is
    RECONSTRUCTED from the trade list instead: every engine in this book calls
    the same `engine_costs.compute_trade_cost`, so commission is
    `max(lot x rate, floor) x 2` and swap is `-rate x lot x days_held`, with
    `days_held` 0 for a position that opens and closes the same broker day.
    The reconstruction is checked against the one engine that does report its
    own cost, and that check is what licenses applying it to the other three.

    ⚠ SPREAD IS NOT IN HERE. Fills are built from the spread recorded on each
    M1 bar, so the spread is already paid inside `pnl` and cannot be separated
    out of it. These are the EXPLICIT charges only: commission and swap.
    """
    from app.services import portfolio_simulator as PSIM
    from app.services import sweep_runner as SR
    from app.services import parity_gate as PG

    p = EAP.get(pid)
    if not p.get("engine_version"):
        return None
    deposit = EAP.report_run_base(p)
    run_params = dict(p.get("params") or {})
    try:
        rp = PG._report_path(p)
        if rp and rp.exists():
            hdr = PG.parse_report_header(rp.read_bytes())
            run_params.update(PG.report_inputs_as_params(
                PG._resolve_forward(p["engine_version"]), hdr.get("inputs") or {}))
    except Exception:
        pass
    run_params.update({"compound": True, "balance": deposit,
                       "balance_add": 0.0, "balance_override": 0.0})
    #  Same arguments `member_stream` used, so this reads that run's cache
    #  rather than paying for the engine a second time.
    tr = PSIM._run_strategy_trades(
        {"ea_version": p["engine_version"], "symbol": p["symbol"],
         "params_json": json.dumps(run_params), "calc_mode": "engine"},
        p.get("date_from") or "2018-01-01", through, deposit)
    if tr is None or not len(tr):
        return None

    cfg = SR._resolve_costs(p["symbol"])
    rate = float(cfg.get("commission_value") or 0.0)
    floor = float(cfg.get("min_commission") or 0.0)
    lots = tr["lot"].to_numpy(dtype=float)
    commission = np.maximum(lots * rate, floor) * 2.0

    held = ((pd.to_datetime(tr["exit_time"]).dt.normalize()
             - pd.to_datetime(tr["entry_time"]).dt.normalize())
            .dt.days.clip(lower=0).to_numpy(dtype=float))
    longs = (tr["direction"].astype(str).str.lower() == "long").to_numpy()
    swap_rate = np.where(longs, float(cfg.get("swap_long_per_lot") or 0.0),
                         float(cfg.get("swap_short_per_lot") or 0.0))
    #  MT5 reports a POSITIVE swap as a credit; the engines invert the sign to
    #  turn it into a cost, and so does this.
    swap = -swap_rate * held * lots

    net = tr["pnl"].to_numpy(dtype=float)
    check = None
    if "cost" in tr.columns:
        reported = tr["cost"].to_numpy(dtype=float)
        check = round(float(np.abs(reported - (commission + swap)).max()), 4)
        #  Trust the engine's own figure where it has one.
        commission = np.where(True, commission, commission)
        swap = reported - commission

    #  `balance_before` compounds over the member's WHOLE history, because
    #  that is what `member_stream` divided by — but only the trades the merged
    #  stream kept are summed. `_merged` aligns the book's start to the latest
    #  member's first trade, and counting a member's earlier trades here would
    #  bill the site's curve for trades it never drew.
    bal_before = deposit + np.concatenate([[0.0], np.cumsum(net)[:-1]])
    unit = np.where(bal_before > 0, scale * start / bal_before, 0.0)
    exits = pd.to_datetime(tr["exit_time"]).dt.tz_localize(None).to_numpy()
    keep = (exits >= window[0]) & (exits <= window[1])
    unit = unit * keep
    comm_site = float((commission * unit).sum())
    swap_site = float((swap * unit).sum())
    net_site = float((net * unit).sum())
    return {
        "gross": round(net_site + comm_site + swap_site, 0),
        "commission": round(comm_site, 0),
        "swap": round(swap_site, 0),
        "net": round(net_site, 0),
        "commission_per_side": rate,
        "n_trades": int(keep.sum()),
        #  Max $ disagreement between the reconstruction and the engine's own
        #  `cost`, where it reports one. None = that engine reports nothing to
        #  check against.
        "recon_max_err": check,
    }


#  The cut between "how it used to behave" and "how it is behaving now". The
#  site's third window starts here, so health answers the same question the
#  chart poses: is the newest slice still the strategy that was fitted?
HEALTH_SPLIT = "2026-08-01"


def health(pnls: np.ndarray, times: np.ndarray, start: float) -> dict | None:
    """Recent behaviour against prior behaviour, per strategy.

    This is Strategy Lab's Concerns panel pointed at a backtest instead of a
    live account: the SAME `concerns_service.metrics_from_trades` bundle and
    the SAME `concern_thresholds` rows decide warn / critical, so a strategy
    that would raise a flag in the console raises the same flag here.

    Both sides are backtest. Nothing on this page is live fills — what is being
    tested is whether the newest stretch still looks like the strategy that was
    fitted, not whether a broker filled it the same way.
    """
    from app.services import concerns_service as CS

    cut = np.datetime64(HEALTH_SPLIT)
    pairs = [(pd.Timestamp(t), float(p)) for t, p in zip(times, pnls)]
    before = [(t, p) for t, p in pairs if t < pd.Timestamp(HEALTH_SPLIT)]
    after = [(t, p) for t, p in pairs if t >= pd.Timestamp(HEALTH_SPLIT)]
    if len(before) < 2 or len(after) < 1:
        return None

    def bundle(rows, lo, hi):
        m = CS.metrics_from_trades(
            rows, starting_balance=start,
            window_from=pd.Timestamp(lo).to_pydatetime(),
            window_to=pd.Timestamp(hi).to_pydatetime(), is_live=False)
        return {
            "n_trades": m.n_trades,
            "net_pnl": round(float(m.net_pnl), 0),
            "win_rate_pct": round(float(m.win_rate_pct), 1),
            "profit_factor": (round(float(m.profit_factor), 2)
                              if m.profit_factor is not None else None),
            "sharpe": round(float(m.sharpe), 2),
            "max_dd_pct": round(float(m.max_dd_pct), 2),
            "longest_lose_streak": int(m.longest_lose_streak),
            "avg_days_between_trades": (round(float(m.avg_days_between_trades), 1)
                                        if m.avg_days_between_trades else None),
        }

    base = bundle(before, times[0], cut)
    now = bundle(after, cut, times[-1])

    #  The lab's own thresholds, read from the same table the console reads.
    conn = sqlite3.connect(LAB / "data" / "lab.sqlite")
    conn.row_factory = sqlite3.Row
    rules = [dict(r) for r in conn.execute(
        "select * from concern_thresholds where enabled = 1")]
    conn.close()

    flags = []
    for r in rules:
        key = r["metric"]
        if key not in base or base.get(key) in (None, 0) or now.get(key) is None:
            continue
        ratio = float(now[key]) / float(base[key])
        if r["rule"] == "ratio_gt":
            level = ("critical" if ratio > r["critical_threshold"]
                     else "warn" if ratio > r["warn_threshold"] else "ok")
        else:
            level = ("critical" if ratio < r["critical_threshold"]
                     else "warn" if ratio < r["warn_threshold"] else "ok")
        flags.append({"metric": key, "ratio": round(ratio, 2), "level": level})

    worst = ("critical" if any(f["level"] == "critical" for f in flags)
             else "warn" if any(f["level"] == "warn" for f in flags) else "ok")
    return {"split": HEALTH_SPLIT, "before": base, "after": now,
            "flags": flags, "verdict": worst}


def stats(pnls: np.ndarray, times: np.ndarray, start: float,
          compounding: bool) -> dict | None:
    """Window metrics from the LAB'S OWN bundle (`portfolio_sim._rich`, which
    calls `metrics.py`), so the site reports exactly what the console reports.

    Each window is measured as its own fixed-size run on the same $20k base:
    the point of static sizing is that a dollar of 2026 P&L means what a dollar
    of 2018 P&L means, and restating a later window against a grown balance
    would put the compounding back in through the metrics.
    """
    if len(pnls) < 2:
        return None
    r = PS._rich(pnls, times, start, compounding=compounding)
    span = max(float((times[-1] - times[0]) / np.timedelta64(1, "D")), 1.0)
    return {
        "from": pd.Timestamp(times[0]).strftime("%Y-%m-%d"),
        "to": pd.Timestamp(times[-1]).strftime("%Y-%m-%d"),
        "years": round(span / 365.25, 2),
        "n_trades": r["n_trades"],
        "return_pct": r["net_pnl_pct"],
        "net_pnl": r["net_pnl"],
        #  Linear for static sizing — `_annualise` picks the basis, not us.
        "cagr_pct": r["cagr_pct"],
        "max_dd_pct": r["max_dd_pct"],
        "max_dd_abs": r["max_dd_abs"],
        "calmar": r["calmar"],
        "sharpe": r["sharpe"],
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--portfolio", default="99.Resume Portfolio",
                    help="portfolio id, or a unique fragment of its name")
    ap.add_argument("--out", default=str(OUT))
    #  STATIC (fixed size) is the default for the site. The lab optimises on a
    #  compounding basis, but a compounding curve on a public page reads as a
    #  growth claim: 8 years of reinvestment put the last year three orders of
    #  magnitude above the first, and every number on the page then describes
    #  position sizes nobody ever traded. Fixed size off the starting balance
    #  keeps a dollar in 2026 worth a dollar in 2018, which is the only basis
    #  on which the three windows can honestly be compared side by side.
    ap.add_argument("--compounding", action="store_true",
                    help="reinvest (the lab's own basis); default is fixed size")
    #  The site states the capital the curve is drawn on, and that statement has
    #  to match the axis. Overriding here rather than editing the portfolio row
    #  keeps the lab's own record ($20k, the basis its scales were fitted on)
    #  untouched. Under STATIC sizing this is a pure rescale: every trade's P&L
    #  is scale*ret*start, so return %, drawdown %, Calmar and Sharpe are all
    #  identical and only the dollar axis moves. Under compounding it is NOT —
    #  do not pass it with --compounding and expect the same numbers.
    ap.add_argument("--start", type=float, default=10000.0,
                    help="capital the curve is drawn on (default 10000)")
    #  SITE-ONLY RISK SCALE. Every member's size is multiplied by this before
    #  anything is computed. Under static sizing it is a clean dial: dollars,
    #  return % and drawdown % all move together, so Calmar and Sharpe come out
    #  identical and only the magnitude of the claim changes. The lab's own
    #  scales are untouched — this is a presentation choice, not a re-fit.
    ap.add_argument("--scale", type=float, default=0.5,
                    help="multiplier on every member's size (default 0.5)")
    ap.add_argument("--mode", choices=["engine", "report"], default="engine",
                    help="engine: re-run each member over the data lake, so a "
                         "daily sync actually moves. report: the uploaded "
                         ".html's own trades, frozen at its generation date.")
    ap.add_argument("--through", default=date.today().isoformat(),
                    help="last date the engine run may reach (default today)")
    args = ap.parse_args()
    compounding = bool(args.compounding)
    if args.mode == "engine":
        force_engine_mode(args.through)
    closed_trades_only()

    conn = sqlite3.connect(LAB / "data" / "lab.sqlite")
    conn.row_factory = sqlite3.Row
    port = resolve(conn, args.portfolio)

    members = [dict(r) for r in conn.execute(
        """select m.profile_id, m.scale, p.symbol, p.family, p.n_trades
           from portfolio_members m join ea_profiles p on p.id = m.profile_id
           where m.portfolio_id = ? order by m.sort_order""", (port["id"],))]
    if not members:
        raise SystemExit(f"{port['name']!r} has no members")

    ids = sorted(m["profile_id"] for m in members)
    scales = {m["profile_id"]: float(m["scale"] or 0.0) * args.scale
              for m in members}
    start = float(args.start if args.start else port["start_balance"])

    #  The lab's own merged trade stream, replayed on ONE shared balance. The
    #  two bases are `portfolio_sim`'s own (see its module docstring):
    #    compounding  equity = start * cumprod(1 + scale*ret)
    #    static       equity = start * (1 + cumsum(scale*ret))
    #  i.e. under static every trade is sized off the STARTING balance, so its
    #  P&L in dollars is scale*ret*start and the curve adds rather than grows.
    idx, t, ret, _ = PS._merged(ids)
    sc = np.array([scales[ids[i]] for i in idx])
    scaled = np.maximum(sc * ret, -0.99)
    if compounding:
        eq = start * np.cumprod(1.0 + scaled)
        pnls = np.diff(np.concatenate([[start], eq]))
    else:
        pnls = scaled * start
        eq = start + np.cumsum(pnls)
    s = pd.Series(eq, index=pd.to_datetime(t))

    #  How independent the legs actually are, measured rather than asserted.
    #  Full-period correlation is the easy number; the one that decides whether
    #  a book survives is the DRAWDOWN-CONDITIONAL one — do these bleed
    #  together on the days it hurts — so both ship.
    _d = pd.DataFrame({"t": pd.to_datetime(t), "k": idx, "p": pnls})
    legs_daily = _d.pivot_table(index=_d["t"].dt.normalize(), columns="k",
                                values="p", aggfunc="sum").fillna(0.0)
    def _pairs(frame: pd.DataFrame) -> np.ndarray:
        cm = frame.corr().to_numpy()
        return cm[np.triu_indices(len(cm), 1)]
    worst = legs_daily.sum(axis=1)
    bad = worst <= worst.quantile(0.20)
    full, dd = _pairs(legs_daily), _pairs(legs_daily[bad])
    #  The full pairwise matrix, reordered into MEMBER order so the site can
    #  label it with the same Strategy A..H it uses everywhere else. The merged
    #  stream indexes legs by their position in the SORTED id list, which is a
    #  different order — left unmapped, the matrix reads as if the wrong pair
    #  were the correlated one.
    order = [ids.index(m["profile_id"]) for m in members]
    ordered = legs_daily.reindex(columns=range(len(ids))).iloc[:, order]

    def _matrix(frame: pd.DataFrame) -> list:
        m = frame.corr().to_numpy()
        return [[None if np.isnan(v) else round(float(v), 2) for v in row]
                for row in m]
    correlation = {
        "basis": "daily P&L per leg, Pearson",
        "matrix": _matrix(ordered),
        "matrix_dd": _matrix(ordered[bad]),
        "n_days": int(len(legs_daily)),
        "n_days_dd": int(bad.sum()),
        "mean": round(float(np.nanmean(full)), 3),
        "max": round(float(np.nanmax(full)), 2),
        "dd_mean": round(float(np.nanmean(dd)), 3),
        "dd_max": round(float(np.nanmax(dd)), 2),
        "dd_quantile_pct": 20,
    }

    #  One point per calendar day. A trade-indexed curve crowds the busy years
    #  and stretches the quiet ones; a date axis is what a reader expects.
    daily = s.resample("D").last().ffill().dropna()
    daily = pd.concat(
        [pd.Series([start], index=[daily.index[0] - pd.Timedelta(days=1)]), daily])

    #  PER-LEG SERIES, on the same daily grid as the combined curve and the
    #  same $10k base. Each leg's line is its OWN contribution to the book —
    #  its scaled P&L, cumulated — so the eight of them add up to the combined
    #  curve exactly. Showing each strategy's standalone run instead would be a
    #  different (and unaddable) chart: these are the shares of one balance.
    per_leg = pd.DataFrame({"t": pd.to_datetime(t), "k": idx, "p": pnls})
    leg_daily = (per_leg.pivot_table(index=per_leg["t"].dt.normalize(), columns="k",
                                     values="p", aggfunc="sum")
                 .reindex(columns=range(len(ids)))
                 .reindex(daily.index).fillna(0.0).cumsum())

    #  Windows are cut on the TRADE stream, not the daily curve, so the metric
    #  bundle sees the same trades the lab would — a resampled daily series has
    #  no trade count and its drawdown misses intraday excursions.
    bands = []
    for key, label, lo, hi in BANDS:
        m = t >= np.datetime64(lo)
        if hi:
            m &= t < np.datetime64(hi)
        bands.append({
            "key": key, "label": label, "from": lo,
            "to": hi or daily.index[-1].strftime("%Y-%m-%d"),
            "stats": stats(pnls[m], t[m], start, compounding),
        })

    #  One card's worth of numbers per leg, from the lab's own bundle, over the
    #  whole period. Windowing these per band as well would be 24 bundles for a
    #  panel nobody asked to slice; the combined cards already carry the
    #  window story.
    #  Every non-empty combination of the window pills, so a per-strategy card
    #  can follow the same filter the chart does. Seven subsets of three bands
    #  is cheap, and it is the only way to answer "this strategy, over just the
    #  windows I am looking at" exactly — a client-side estimate off the daily
    #  curve would quietly report a DIFFERENT Sharpe and drawdown basis from
    #  the one every other number on the page uses.
    band_masks = {}
    for key, _label, lo, hi in BANDS:
        bm = t >= np.datetime64(lo)
        if hi:
            bm &= t < np.datetime64(hi)
        band_masks[key] = bm
    subsets = []
    keys = [b[0] for b in BANDS]
    for n in range(1, 1 << len(keys)):
        subsets.append([k for j, k in enumerate(keys) if n >> j & 1])

    legs = []
    for k, m in enumerate(members):
        pid = m["profile_id"]
        col = ids.index(pid)
        mask = idx == col
        st = stats(pnls[mask], t[mask], start, compounding) if mask.sum() > 1 else None
        by = {}
        for sub in subsets:
            sm = mask.copy()
            pick = np.zeros(len(t), dtype=bool)
            for key in sub:
                pick |= band_masks[key]
            sm &= pick
            if sm.sum() > 1:
                by["+".join(sub)] = stats(pnls[sm], t[sm], start, compounding)
        legs.append({
            "symbol": m["symbol"],
            "family": m["family"],
            "scale": round(scales[pid], 3),
            "n_trades": int(mask.sum()),
            "stats": st,
            "by": by,
            "health": health(pnls[mask], t[mask], start),
            "cost": cost_breakdown(pid, scales[pid], start,
                                   args.through, (t[0], t[-1])),
            #  Dollars, rounded — aligned index-for-index with `curve`, so the
            #  file does not repeat the date axis eight more times.
            "series": [int(round(v)) for v in leg_daily[col].to_numpy()],
        })

    #  BUY & HOLD BASELINE. The honest question a reader asks of any book is
    #  "versus just owning the index?", so the answer ships with the chart
    #  rather than waiting to be asked.
    #
    #  SIZED THE SAME WAY THE BOOK IS: $start of notional, held, with each
    #  day's P&L the index's percentage move on that $start — no compounding,
    #  because the book does not compound either and the page compares them
    #  side by side.
    #
    #  ⚠ `rel` IS AN EQUITY INDEX, NOT A PRICE RATIO. It used to be
    #  `price / price[0]`, which is a compounding buy-and-hold curve — right
    #  for the full span and wrong for every window inside it. The site rebases
    #  by SUBTRACTING the level at the window's open, so a 2018-based ratio
    #  handed it each day's move already multiplied by how far the index had
    #  risen since 2018: the live window's real +4.6% was published as +12.1%.
    #  Building it as 1 + cumsum(pct_change) makes a difference between any two
    #  points mean the same thing the book's does — percent of $start.
    bench = None
    try:
        bench_px = (pd.read_parquet(LAB / "data" / "raw" / "US500.parquet",
                                    columns=["close"])["close"]
                    .resample("D").last().ffill().dropna())
        bench_px.index = pd.to_datetime(bench_px.index).tz_localize(None)
        aligned = bench_px.reindex(daily.index, method="ffill").bfill()
        rel = 1.0 + aligned.pct_change().fillna(0.0).cumsum()
        #  Metrics on the SAME basis as the book's — the lab's own bundle with
        #  compounding off, over the same fixed-size series the line draws.
        bpnl = (rel.diff().fillna(0.0) * start).to_numpy()
        btime = rel.index.to_numpy()
        bby = {}
        for sub in subsets:
            pick = np.zeros(len(btime), dtype=bool)
            for key in sub:
                lo = next(b[2] for b in BANDS if b[0] == key)
                hi = next(b[3] for b in BANDS if b[0] == key)
                m = btime >= np.datetime64(lo)
                if hi:
                    m &= btime < np.datetime64(hi)
                pick |= m
            if pick.sum() > 2:
                bby["+".join(sub)] = stats(bpnl[pick], btime[pick], start,
                                           compounding)
        bench = {
            "symbol": "US500",
            "label": "S&P 500 buy & hold",
            #  Index relative to day one, so the site can rebase it onto
            #  whatever window is on screen exactly as it rebases the book.
            "rel": [round(float(v), 6) for v in rel],
            "stats": bby.get("+".join(b[0] for b in BANDS)),
            "by": bby,
        }
    except Exception as exc:                                   # noqa: BLE001
        print(f"  benchmark skipped: {exc}")

    payload = {
        "generated": date.today().isoformat(),
        "portfolio": "Research portfolio #99",
        "basis": "backtest",
        "stream": args.mode,
        "through": args.through if args.mode == "engine" else None,
        "sizing": "compounding" if compounding else "static",
        "risk_scale": args.scale,
        "start_balance": start,
        "dd_cap_pct": port["max_dd_pct"],
        "members": len(ids),
        "assets": sorted({m["symbol"] for m in members}),
        #  Per-member detail, so the page can say WHAT the book is made of
        #  instead of only how it performed. Family + symbol is the whole
        #  identity a reader needs; the profile id stays out of the file.
        "legs": legs,
        "families": sorted({m["family"] for m in members}),
        "correlation": correlation,
        "benchmark": bench,
        "n_trades": int(len(t)),
        "bands": bands,
        #  [days since epoch, equity]. Integer offsets keep the file small; the
        #  chart rebuilds the dates.
        "epoch": "2018-01-01",
        "curve": [[int((ts - pd.Timestamp("2018-01-01")).days), round(float(v), 2)]
                  for ts, v in daily.items()],
    }
    p = pathlib.Path(args.out)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")

    print(f"{port['name']}  -  {len(ids)} members, {len(t):,} trades, "
          f"{'compounding' if compounding else 'static'} sizing")
    try:
        shown = p.relative_to(HERE)
    except ValueError:
        shown = p
    print(f"wrote {shown}  ({p.stat().st_size / 1024:.0f} KB, "
          f"{len(payload['curve']):,} points)")
    for b in bands:
        st = b["stats"]
        if not st:
            print(f"  {b['label']:14s} (no data in window)")
            continue
        print(f"  {b['label']:14s} {st['from']} -> {st['to']}   "
              f"ann {st['cagr_pct']:7.1f}%   maxDD {st['max_dd_pct']:5.2f}%   "
              f"Calmar {st['calmar']}   Sharpe {st['sharpe']}")


if __name__ == "__main__":
    main()
