import type { Metadata } from "next";
import { Geist_Mono, Work_Sans } from "next/font/google";

import { SiteHeader } from "@/components/site-header";
import "./globals.css";

/*  Same two faces as Strategy Lab: Work Sans for prose, Geist Mono for
    anything numeric or label-like, so a figure here and the same figure in
    the tool are set identically.                                          */
const workSans = Work_Sans({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chutithep Engmahussakul — Quant Strategy Research",
  description:
    "Systematic trading research: documented hypotheses, costs measured at the traded minute, out-of-sample tests, and the tooling that keeps them honest.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${workSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <SiteHeader />
        {/*  1400px, not 1152. The charts are the reason this site exists and
            they were being squeezed into two-thirds of a wide screen with the
            rest of it empty. Prose keeps its own measure inside this. */}
        <main className="mx-auto max-w-[1400px] px-5 pb-28 sm:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
