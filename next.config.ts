import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  //  Both of these are server-rendering features — partial prerendering has
  //  nothing to stream from on a static host, and the build refuses outright
  //  ("PPR cannot be enabled in export mode"). The site has no dynamic data,
  //  so neither was doing anything for it.
  cacheComponents: false,
  //  STATIC EXPORT. The site is pure HTML, CSS and JSON, so it ships to a
  //  static host with no Node runtime at all.
  //
  //  ⚠ This drops `redirects()` — a static host has nothing to run them on.
  //  The only redirect was /results -> /, from before this page moved to the
  //  root, and that URL was never public.
  output: "export",
  //  Pages serves directories, so every route needs its own index.html.
  trailingSlash: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
