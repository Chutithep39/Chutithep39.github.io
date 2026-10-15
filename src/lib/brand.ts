/**
 *  Who the site says it belongs to — set at BUILD time, never in source.
 *
 *  The same code builds two public sites: the personal one (repository variable
 *  SITE_NAME = the owner's name, GOATCOUNTER = its counter) and an anonymous mirror
 *  for job posts (no SITE_NAME → the neutral brand, no GOATCOUNTER → no analytics).
 *  Keeping the name out of the source is what lets the mirror publish this same tree
 *  without leaking it (owner, 2026-10-15).
 */
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "Quant Research Notes";

/** First word gets the accent colour in the header; the rest is muted. */
export const SITE_NAME_HEAD = SITE_NAME.split(" ")[0];
export const SITE_NAME_TAIL = SITE_NAME.slice(SITE_NAME_HEAD.length);

/** GoatCounter count endpoint, or "" to load no analytics at all. */
export const GOATCOUNTER_ENDPOINT = process.env.NEXT_PUBLIC_GOATCOUNTER?.trim() || "";

/** Microsoft Clarity project id, or "" for none. Loaded only after the visitor accepts (see clarity.tsx). */
export const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY?.trim() || "";

/** Public origin of this build (for absolute link-preview URLs), e.g. https://example.github.io */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://quant-research-notes.github.io";
