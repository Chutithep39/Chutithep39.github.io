"use client";

import { useEffect, useState } from "react";

/*  True on a phone-width screen. Starts false so the static HTML and the
 *  first client render agree, then flips after mount. Charts use it to draw a
 *  narrower viewBox instead of shrinking the desktop one until its labels are
 *  four pixels tall.
 */
export function useNarrow(max = 639) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${max}px)`);
    const set = () => setNarrow(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, [max]);
  return narrow;
}
