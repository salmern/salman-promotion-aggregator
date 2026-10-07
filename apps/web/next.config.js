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
  transpilePackages: ['@promotions/shared'],
};

module.exports = nextConfig;
