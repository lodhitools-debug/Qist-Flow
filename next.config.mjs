/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents double initialization in dev for Baileys/websockets
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@whiskeysockets/baileys', 'pino', 'qrcode'],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
