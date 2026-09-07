/** @type {import('next').NextConfig} */
const config = {
  images: {
    // Company logos come from arbitrary employer domains and the logo CDNs
    // the ATS platforms use, so the host list can't be enumerated up front.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default config;
