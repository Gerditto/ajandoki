import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // A Cache Components a Cloudflare-adapterben (OpenNext) még nem teljesen támogatott,
  // ezért egyelőre kikapcsolva; minden bejelentkezett oldal amúgy is dinamikus.
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
