"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*  Adds `is-in` the first time a block reaches the viewport, and then stops
 *  watching it. One-shot on purpose: a section that re-animates every time it
 *  scrolls back into view is a section nobody can re-read.
 *
 *  The observer fires slightly BEFORE the block is fully on screen, so the
 *  motion reads as the page arriving rather than as a delayed reaction to
 *  scrolling past something.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    //  Tells the stylesheet it is safe to hide un-revealed blocks: without
    //  this the page renders invisible for anyone whose JS never runs.
    document.documentElement.classList.add("anim");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    //  No observer (or a very short page) means show it rather than hide it —
    //  deferred, because setting state synchronously inside an effect makes
    //  React re-run the whole tree before it has finished committing.
    if (typeof IntersectionObserver === "undefined") {
      const id = requestAnimationFrame(() => setSeen(true));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    io.observe(el);
    //  DEAD-MAN SWITCH. If the observer never fires — headless renderers, an
    //  unusual zoom, a browser that throttles it — the block would stay at
    //  opacity 0 and the reader would see an empty page. Showing it late is a
    //  missed animation; never showing it is a broken site.
    const bail = setTimeout(() => setSeen(true), 2500);
    return () => {
      io.disconnect();
      clearTimeout(bail);
    };
  }, [seen]);

  return (
    <div
      ref={ref}
      className={["reveal", seen ? "is-in" : "", className].join(" ")}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
