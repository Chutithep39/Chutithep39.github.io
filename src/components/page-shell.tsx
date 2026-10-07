import Link from "next/link";
import type { ReactNode } from "react";

import { SECTIONS, hrefOf, type Section } from "@/lib/sections";

/*  Every section page gets the same frame: the question it answers, its
 *  title, the content, and a link on to the next section so a reader is never
 *  left at a dead end.
 */
export function PageShell({
  meta,
  children,
}: {
  meta: Section;
  children?: ReactNode;
}) {
  const i = SECTIONS.findIndex((s) => s.slug === meta.slug);
  const next = SECTIONS[(i + 1) % SECTIONS.length];

  return (
    <article className="py-14 sm:py-20">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {meta.eyebrow}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {meta.label}
      </h1>
      <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
        {meta.blurb}
      </p>

      <div className="mt-10">{children ?? <Pending />}</div>

      <nav className="mt-16 border-t border-border pt-6">
        <Link
          href={hrefOf(next)}
          className="group inline-flex items-baseline gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
            Next
          </span>
          <span className="text-foreground">{next.label}</span>
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            &rarr;
          </span>
        </Link>
      </nav>
    </article>
  );
}

/*  An honest gap. A nav link that opens an empty page looks broken; this says
 *  the page is planned and not yet written, which is true.
 */
function Pending() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-5 py-10">
      <p className="font-mono text-xs text-muted-foreground">Not written yet.</p>
    </div>
  );
}
