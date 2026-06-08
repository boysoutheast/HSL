/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.cloudflare.com' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma', 'bcryptjs'],
  },
}
