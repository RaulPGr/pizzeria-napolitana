import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ❗ ignora ESLint en Vercel/producción
  eslint: { ignoreDuringBuilds: true },

  // (opcional) si algún día te falla por tipos TS en build:
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
