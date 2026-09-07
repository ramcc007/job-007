import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    // Company logos are fetched from arbitrary employer domains and the
    // logo CDNs the ATS platforms use, so the host list can't be enumerated.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default config;
