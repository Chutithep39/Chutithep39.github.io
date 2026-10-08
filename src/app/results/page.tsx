import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CorrelationMatrix } from "@/components/correlation-matrix";
import { CostTable } from "@/components/cost-table";
import { EquityCurve } from "@/components/equity-curve";
import { Tour } from "@/components/tour";
import { SECTIONS, bySlug, hrefOf } from "@/lib/sections";

/*  THE EVIDENCE PAGE.
 *
 *  Home makes the claims; this page is where a reader checks them. Everything
 *  on it is interactive, which is the point — the figures can be re-cut by
 *  window and by strategy rather than taken on trust.
 */
const meta = bySlug("results");

export const metadata: Metadata = {
  title: "Chutithep Engmahussakul — Quantitative trading research",
  description: meta?.blurb,
};

export default function Results() {
  if (!meta) notFound();
  //  The NEXT section in the spine, not every other one. With Home now in the
  //  list, "everything else" rendered two "Next" links pointing opposite ways.
  const i = SECTIONS.findIndex((s) => s.slug === meta.slug);
  const next = SECTIONS[(i + 1) % SECTIONS.length];

  return (
    <div className="py-14 sm:py-20">
      <div data-tour="intro">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {meta.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {meta.label}
        </h1>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
          {meta.blurb}
        </p>
      </div>

      <div className="mt-10 space-y-12">
        <EquityCurve />
        <CostTable />
        <CorrelationMatrix />
      </div>

      {/*  One page follows this one, so it gets a link and not a card grid.
          A single card in a two-column index reads as a page with something
          missing from it.                                                  */}
      <nav data-tour="next" className="mt-16 border-t border-border pt-6">
        {[next].map((s) => (
          <Link
            key={s.slug}
            href={hrefOf(s)}
            className="group inline-flex items-baseline gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
              Next
            </span>
            <span className="text-foreground">{s.label}</span>
            <span
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            >
              &rarr;
            </span>
          </Link>
        ))}
      </nav>

      <Tour />
    </div>
  );
}
