/*  The site's spine, in one place — two pages, on purpose.
 *
 *  Each section is its OWN ROUTE, not an anchor: a reader who is scanning
 *  wants to open the one thing they care about, and a link they can send to a
 *  colleague should land on that thing and nothing else.
 *
 *  Ordered to answer a hiring reader's questions in the order they ask them.
 *  The nav, the home-page index and the routes all read from this list, so a
 *  section can never exist in one and not the others.
 *
 *  It was eight. Six of them were drafts a reader would have clicked into and
 *  found empty, which costs more credibility than their titles were buying.
 *  What is left is the evidence and the write-up behind it.
 */
export type Section = {
  slug: string;
  /** Where the section actually lives. Only set when it is not `/<slug>` —
      Portfolio Performance IS the landing page, so it answers on "/" while
      keeping its slug as the id everything else looks it up by. */
  href?: string;
  label: string;
  /** Says which question the page answers. Shown as the eyebrow. */
  eyebrow: string;
  /** One line, shown on the home index. */
  blurb: string;
  ready: boolean;
};

export const SECTIONS: Section[] = [
  {
    slug: "results",
    href: "/",
    label: "Portfolio Performance",
    eyebrow: "Quantitative trading, 2018-2026",
    blurb:
      "Performance of a portfolio of eight uncorrelated strategies across five instruments, sized at fixed risk based on $15k initial capital, split into fitted in-sample, out-of-sample, and live.",
    ready: true,
  },
  {
    slug: "kill-log",
    label: "How I research my strategies",
    eyebrow: "One candidate, written up in full",
    blurb:
      "From formulating the hypothesis, defining the metrics, conducting analysis, to backtesting, robustness test, and correlation analysis.",
    ready: true,
  },
];

export const bySlug = (slug: string) => SECTIONS.find((s) => s.slug === slug);
export const hrefOf = (s: Section) => s.href ?? `/${s.slug}`;
