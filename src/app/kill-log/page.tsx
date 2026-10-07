import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CaseStudyView } from "@/components/case-study";
import { PageShell } from "@/components/page-shell";
import { CASE_STUDIES } from "@/data/case-studies";
import { bySlug } from "@/lib/sections";

const meta = bySlug("kill-log");

export const metadata: Metadata = {
  title: `${meta?.label} — Chutithep Engmahussakul`,
  description: meta?.blurb,
};

export default function Page() {
  if (!meta) notFound();
  return (
    <PageShell meta={meta}>
      <div className="divide-y divide-border">
        {CASE_STUDIES.map((study) => (
          <div key={study.slug} className="py-16 first:pt-0 last:pb-0">
            <CaseStudyView study={study} />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
