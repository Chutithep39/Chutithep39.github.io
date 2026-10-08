"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/*  GoatCounter.
 *
 *  Chosen over the alternatives because it needs no cookie, no consent banner
 *  and no account of the visitor at all: it records the path, the referrer and
 *  the query string, which is exactly as much as this site needs to answer
 *  "did the link I sent get opened".
 *
 *  ⚠ THE PLAIN SNIPPET IS NOT ENOUGH HERE. count.js fires once, on load. This
 *  site routes on the client, so every page a reader reaches by clicking the
 *  nav would go uncounted — the first page would be the only one ever
 *  recorded. The effect below counts each subsequent path itself.
 *
 *  The query string is sent along deliberately: the "?ref=" tag on a link is
 *  the whole point of having this.
 */
const ENDPOINT = "https://chutithep.goatcounter.com/count";

declare global {
  interface Window {
    goatcounter?: { count?: (vars: { path: string }) => void };
  }
}

export function Analytics() {
  const path = usePathname();
  //  The script's own load already counted the first view; counting it again
  //  here would double every landing.
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.goatcounter?.count?.({
      path: path + window.location.search,
    });
  }, [path]);

  return (
    <Script
      data-goatcounter={ENDPOINT}
      src="https://gc.zgo.at/count.js"
      strategy="afterInteractive"
    />
  );
}
