"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { MEMBERS, START, money, word } from "@/lib/facts";

/*  A first-run walkthrough for the page's controls.
 *
 *  Almost everything here is clickable or hoverable and none of it looks it:
 *  pills that filter, a toggle that changes what the chart MEANS, cards that
 *  isolate a line, a matrix whose two halves are different measurements. A
 *  reader who never discovers any of that sees a static page and leaves.
 *
 *  Rules it follows:
 *    - Runs ONCE, then remembers. Nobody wants a tour twice.
 *    - Every step is skippable from the first frame, and Escape closes it.
 *    - Steps that need the page in a particular state put it there (the
 *      per-strategy cards do not exist until the chart is in that mode) and
 *      put it back afterwards.
 *    - It drives the chart through an event rather than owning its state, so
 *      the chart stays usable with the tour switched off entirely.
 */

export type Step = {
  /** `data-tour` value of the element to spotlight. */
  target: string;
  title: string;
  body: string;
  /** Chart reading this step needs on screen. */
  mode?: "combined" | "legs";
};

/*  The walkthrough is now mounted on two pages, so the steps come IN rather
    than being baked in. Everything else — the spotlight, the measuring, the
    first-visit rule — is identical on both.                               */
export const RESULTS_STEPS: Step[] = [
  {
    target: "intro",
    title: "What this page is",
    body:
      `A portfolio of ${word(MEMBERS)} automated strategies, backtested on in-sample data and accounted for real trading costs. The chart below shows in-sample, out-of-sample, and live. Everything on this page is interactive — this walkthrough shows you how to navigate.`,
    mode: "combined",
  },
  {
    target: "periods",
    title: "Three windows, each one optional",
    body:
      `In-sample was fitted. Out-of-sample was scored once and never tuned, live is traded with ${money(START)} base. Click any of them to drop it from the chart — what is left rebases to the same ${money(START)}, so the numbers stay comparable.`,
    mode: "combined",
  },
  {
    target: "mode",
    title: "Two readings of the same book",
    body:
      `Combined is the equity curve of all ${MEMBERS} strategies combined to one. By strategy splits it into the ${word(MEMBERS)} equity curves and splitted performance cards.`,
    mode: "combined",
  },
  {
    target: "chart",
    title: "Hover anywhere on the curve",
    body:
      "The crosshair gives you that day's balance, what it made or lost, and how far below its own high it was sitting.",
    mode: "combined",
  },
  {
    target: "cards",
    title: "Click a card to isolate one strategy",
    body:
      "In the per-strategy reading, clicking a card pushes its line forward and fades the other seven. Click it again to bring them back.",
    mode: "legs",
  },
  {
    target: "cost",
    title: "What the broker took",
    body:
      "Gross, commission, swap and net, per strategy. Every figure elsewhere on the page is the net column — this is the arithmetic behind it.",
    mode: "combined",
  },
  {
    target: "matrix",
    title: "Two measurements in one grid",
    body:
      "Above the diagonal is every day. Below it, in italics, is the worst 20% of days — the half that decides whether these can share one account. Hover any cell to see which pair and which half you are reading.",
    mode: "combined",
  },
  {
    target: "next",
    title: "And what produced all of it",
    body:
      "The tool behind these numbers — the data lake, the engine, the parameter search and the portfolio optimiser, in four screens. The full write-up of one candidate follows it.",
    mode: "combined",
  },
];

const RESULTS_KEY = "tour.home.v1";
const PAD = 10;

type Box = { top: number; left: number; width: number; height: number };

export function Tour({
  steps = RESULTS_STEPS,
  storageKey = RESULTS_KEY,
  label = "How to read this page",
}: {
  steps?: Step[];
  storageKey?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(200);
  const raf = useRef(0);

  const step = steps[i];

  //  Offered rather than forced: it opens itself only on a first visit.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        if (!localStorage.getItem(storageKey)) setOpen(true);
      } catch {
        /* private mode — just don't run */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [storageKey]);

  const close = useCallback((toTop = false) => {
    setOpen(false);
    //  The last step sits at the foot of a very long page. Finishing there
    //  leaves the reader at the bottom of something they have not read.
    if (toTop) window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent("tour:mode", { detail: "combined" }),
    );
  }, [storageKey]);

  //  Put the page in the state this step talks about, then measure.
  useEffect(() => {
    if (!open || !step) return;
    if (step.mode) {
      window.dispatchEvent(new CustomEvent("tour:mode", { detail: step.mode }));
    }
    const find = () =>
      document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);

    const measure = () => {
      const el = find();
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    //  The mode switch re-renders the cards, so wait a frame before measuring
    //  or the spotlight lands on whatever used to be there. Then keep
    //  measuring for a second: a smooth scroll of two thousand pixels is still
    //  moving long after any single timeout would have fired, and a rect taken
    //  mid-flight puts the hole off-screen.
    let stop = 0;
    const t = setTimeout(() => {
      find()?.scrollIntoView({ block: "center", behavior: "smooth" });
      measure();
      const until = Date.now() + 1200;
      const tick = () => {
        measure();
        if (Date.now() < until) stop = requestAnimationFrame(tick);
      };
      stop = requestAnimationFrame(tick);
    }, 60);

    const onMove = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(stop);
      cancelAnimationFrame(raf.current);
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
    };
  }, [open, i, step]);

  //  Re-measure whenever the body changes length; the placement above reads it.
  useLayoutEffect(() => {
    if (!open) return;
    const h = card.current?.offsetHeight;
    if (h && h !== cardH) setCardH(h);
  }, [open, i, cardH]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, steps.length]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setI(0);
          setOpen(true);
        }}
        className="fixed bottom-5 right-5 z-40 rounded-full border border-border bg-card/90 px-4 py-2 text-[12px] text-muted-foreground shadow-lg backdrop-blur transition-colors hover:text-foreground"
      >
        {label}
      </button>
    );
  }

  /*  Tooltip goes below the spotlight when it FITS below, above when it fits
      above, and otherwise is pinned inside the viewport.

      The height is measured rather than assumed. The old code assumed 190px,
      and a step whose body ran to six lines — spotlighting a 700px hero, so
      "below" looked like it had room — pushed the card and both of its
      buttons off the bottom of the screen with no way to continue.        */
  const vw = typeof window === "undefined" ? 1200 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const TW = 360;
  const GAP = 16;
  const below = box ? box.top + box.height + GAP : 0;
  const above = box ? box.top - cardH - GAP : 0;
  const top = !box
    ? vh / 2 - cardH / 2
    : below + cardH + GAP <= vh
      ? below
      : above >= GAP
        ? above
        : Math.max(GAP, vh - cardH - GAP);
  const left = box
    ? Math.min(Math.max(16, box.left + box.width / 2 - TW / 2), vw - TW - 16)
    : vw / 2 - TW / 2;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/*  FOUR PANELS, not one box-shadow. The shadow version depended on a
          9999px spread painting outside its own element, and when the measured
          rect was stale or off-screen the result was a uniformly dimmed page
          with no hole in it at all. Four rectangles around the target cannot
          fail that way: if there is no rect, there is no dimming.         */}
      {box && (
        <>
          <div aria-hidden className="absolute inset-x-0 bg-[rgba(3,7,22,0.80)]"
               style={{ top: 0, height: Math.max(0, box.top - PAD) }} />
          <div aria-hidden className="absolute inset-x-0 bottom-0 bg-[rgba(3,7,22,0.80)]"
               style={{ top: box.top + box.height + PAD }} />
          <div aria-hidden className="absolute bg-[rgba(3,7,22,0.80)]"
               style={{
                 top: box.top - PAD,
                 height: box.height + PAD * 2,
                 left: 0,
                 width: Math.max(0, box.left - PAD),
               }} />
          <div aria-hidden className="absolute right-0 bg-[rgba(3,7,22,0.80)]"
               style={{
                 top: box.top - PAD,
                 height: box.height + PAD * 2,
                 left: box.left + box.width + PAD,
               }} />
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-xl ring-2 ring-[color-mix(in_oklab,var(--primary)_75%,transparent)]"
            style={{
              top: box.top - PAD,
              left: box.left - PAD,
              width: box.width + PAD * 2,
              height: box.height + PAD * 2,
            }}
          />
        </>
      )}

      {/*  Clicking the dimmed area leaves — the usual escape hatch.       */}
      <button
        type="button"
        aria-label="Close walkthrough"
        onClick={() => close()}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <div
        ref={card}
        className="absolute w-[360px] rounded-xl border border-border bg-card p-5 shadow-2xl transition-all duration-300"
        style={{ top, left }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {i + 1} of {steps.length}
        </p>
        <h3 className="mt-2 text-[15px] font-semibold tracking-tight">
          {step.title}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {step.body}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => close()}
            className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip
          </button>
          <div className="ml-auto flex items-center gap-2">
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI(i - 1)}
                className="rounded-md border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                i === steps.length - 1 ? close(true) : setI(i + 1)
              }
              className="grad-primary rounded-md px-3 py-1.5 text-[12px] font-medium text-white"
            >
              {i === steps.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
