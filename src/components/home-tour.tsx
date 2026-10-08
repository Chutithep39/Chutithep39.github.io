"use client";

import { Tour, type Step } from "@/components/tour";
import { LIVE_SPOKEN, SPAN_SPOKEN } from "@/lib/facts";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/*  The landing page's walkthrough.
 *
 *  Shorter than the one on the results page and aimed at a different reader: that
 *  one teaches a chart, this one tells a first-time reader what the site IS
 *  and that the four tabs are four different answers. It opens once per
 *  browser and leaves a button behind afterwards.
 */
const STEPS: Step[] = [
  {
    target: "hero",
    title: "What this is",
    body:
      "A systematic trading research practice, run on my own time with my own tooling. Strategies are stated as a hypothesis, tested against costs and a window held back from the search, and the survivors are deployed as automated systems on MetaTrader 5.",
  },
  {
    target: "nav",
    title: "Four pages, four questions",
    body:
      "Portfolio Performance is the evidence — the equity curve, the cost table and the correlations, all interactive. Strategy Lab is the tool that produced them. How I research my strategies is one candidate followed end to end, kill included.",
  },
  {
    target: "surface",
    title: "This one you can turn",
    body:
      "A real parameter sweep as a 3-D surface: height and colour are the same number. Drag to rotate it, and use the toggle to redraw it on the window the search never saw.",
  },
  {
    target: "snapshot",
    title: "What the book is doing now",
    body:
      `The live window only, against the S&P 500 over the same days. ${cap(LIVE_SPOKEN)} is a progress check and not a track record — the ${SPAN_SPOKEN} behind it are on the performance page.`,
  },
  {
    target: "outcome",
    title: "Most candidates do not survive",
    body:
      "One worked example: an edge that was real, held out of sample, and was still dropped. The reasoning is written up in full.",
  },
];

export function HomeTour() {
  return (
    <Tour steps={STEPS} storageKey="tour.landing.v1" label="Show me around" />
  );
}
