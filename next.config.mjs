/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config) => {
    // thirdweb → @base-org/account → viem → ox pulls in modules we never use.
    // Silence two harmless warnings so the Vercel build log stays clean:
    //  1. pino-pretty — optional dev-only prettifier, not installed, never bundled.
    //  2. ox/tempo's virtualMasterPool — runtime `new Worker(new URL(...))` that
    //     webpack can't statically analyze (Tempo chain is not used).
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /node_modules\/pino/, message: /pino-pretty/ },
      { module: /virtualMasterPool/ },
    ];
    return config;
  },
};

export default nextConfig;
