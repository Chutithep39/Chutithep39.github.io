"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SECTIONS, hrefOf } from "@/lib/sections";

/*  Sticky nav across the real routes.
 *
 *  Active state comes from the pathname rather than a scroll observer, because
 *  the sections are pages now — the URL already knows where the reader is, and
 *  anything else would be a second source of truth that can disagree with it.
 */
export function SiteHeader() {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-[color-mix(in_oklab,var(--background)_82%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-5 sm:px-8">
        <Link
          href="/"
          className="shrink-0 text-sm font-semibold tracking-tight"
          aria-label="Home"
        >
          <span className="grad-primary-text">Chutithep</span>
          <span className="text-muted-foreground"> Engmahussakul</span>
        </Link>

        <nav
          aria-label="Sections"
          className="-mx-2 ml-auto flex min-w-0 items-center gap-0.5 overflow-x-auto px-2
                     [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SECTIONS.map((s) => {
            const href = hrefOf(s);
            const on = path === href;
            return (
              <Link
                key={s.slug}
                href={href}
                aria-current={on ? "page" : undefined}
                className={[
                  "relative whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] transition-colors",
                  on
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {s.label}
                {/*  The only accent in the bar, so the eye tracks exactly one
                    thing. */}
                <span
                  aria-hidden
                  className={[
                    "grad-primary absolute inset-x-3 -bottom-px h-0.5 rounded-full transition-opacity",
                    on ? "opacity-100" : "opacity-0",
                  ].join(" ")}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
