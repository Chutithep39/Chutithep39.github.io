"use client";

/**
 *  Microsoft Clarity (session paths, heatmaps, recordings) — ONLY after the visitor says yes.
 *
 *  Clarity sets cookies, so it is not loaded until the visitor accepts in the banner below; the
 *  choice is remembered in localStorage and can be revisited from the footer-less "Privacy" chip.
 *  With no CLARITY_ID for this build, nothing renders at all.
 */
import { useEffect, useState } from "react";
import { CLARITY_ID } from "@/lib/brand";

const KEY = "clarity-consent";        // "yes" | "no"

function load(id: string) {
  if (document.getElementById("clarity-tag")) return;
  const s = document.createElement("script");
  s.id = "clarity-tag";
  s.async = true;
  s.text = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(id)});`;
  document.head.appendChild(s);
}

export function Clarity() {
  const [choice, setChoice] = useState<string | null>("pending");

  useEffect(() => {
    if (!CLARITY_ID) return;
    let v: string | null = null;
    try { v = localStorage.getItem(KEY); } catch { /* storage blocked: ask every visit */ }
    setChoice(v);
    if (v === "yes") load(CLARITY_ID);
  }, []);

  if (!CLARITY_ID || choice === "pending" || choice === "yes" || choice === "no") return null;

  const decide = (v: "yes" | "no") => {
    try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
    setChoice(v);
    if (v === "yes") load(CLARITY_ID);
  };

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-xl border border-border bg-card/95 p-4 text-[13px] leading-relaxed text-muted-foreground shadow-lg backdrop-blur sm:inset-x-auto sm:right-4"
    >
      <p>
        This site uses Microsoft Clarity to see how pages are used (clicks, scrolling, which pages are
        read). It sets cookies and records sessions without your name. Allow it?
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={() => decide("no")}
          className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2"
        >
          No thanks
        </button>
        <button
          onClick={() => decide("yes")}
          className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2"
        >
          Allow
        </button>
      </div>
    </div>
  );
}
