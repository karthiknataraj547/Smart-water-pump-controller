import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Tell Next.js not to bundle these native/CommonJS packages — use the installed
  // node_modules version directly.
  serverExternalPackages: [
    'mqtt',
    'worker-timers',
    'worker-timers-broker',
    'broker-factory',
    '@prisma/client',
    'prisma',
    '@smartpump/mqtt',
    '@smartpump/database',
    '@smartpump/auth',
    '@smartpump/shared',
    '@smartpump/validation',
  ],

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark mqtt and its transitive deps as external so webpack never bundles them.
      // They rely on require() resolution that breaks when webpack rewrites paths.
      const externalPattern = /^(mqtt|worker-timers|worker-timers-broker|broker-factory|@smartpump\/)/;
      const existingExternals = config.externals || [];
      config.externals = [
        ...(Array.isArray(existingExternals) ? existingExternals : [existingExternals]),
        ({ request }: { request: string }, callback: (err?: Error | null, result?: string) => void) => {
          if (externalPattern.test(request)) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;

