/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  async redirects() {
    return [
      { source: '/test-launches', destination: '/ads?tab=launch', permanent: false },
      { source: '/media-library', destination: '/media?tab=library', permanent: false },
      { source: '/products', destination: '/media?tab=products', permanent: false },
      { source: '/characters', destination: '/influencer', permanent: false },
      { source: '/accounts', destination: '/influencer?tab=roster', permanent: false },
      { source: '/topics', destination: '/influencer?tab=topics', permanent: false },
      { source: '/campaign-monitor', destination: '/ads?tab=monitor', permanent: false },
      { source: '/action-center', destination: '/ads?tab=actions', permanent: false },
      { source: '/rules-editor', destination: '/ads?tab=rules', permanent: false },
      { source: '/media-rules', destination: '/ads?tab=rules', permanent: false },
      { source: '/meta-connections', destination: '/system?tab=connections', permanent: false },
      { source: '/agents', destination: '/system?tab=agents', permanent: false },
      { source: '/workers', destination: '/system?tab=workers', permanent: false },
      { source: '/admin/dead-letters', destination: '/system?tab=workers', permanent: false },
      { source: '/observability', destination: '/system?tab=workers', permanent: false },
      { source: '/admin-users', destination: '/system?tab=users', permanent: false },
      { source: '/docs', destination: '/system?tab=docs', permanent: false },
      { source: '/approval-requests', destination: '/ads?tab=actions', permanent: false },
      { source: '/launches', destination: '/ads?tab=launch', permanent: false },
    ]
  },
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
