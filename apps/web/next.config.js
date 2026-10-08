/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn-files.eu.placewise.com' },
      { protocol: 'https', hostname: 'shopstyle.it' },
      { protocol: 'https', hostname: '**.placewise.com' },
    ],
  },
  // @promotions/shared is pre-built to dist/src/ — no transpilation needed.
  // Removing transpilePackages avoids Next.js hanging on the monorepo's
  // TypeScript project reference chain during dev.
};

module.exports = nextConfig;
