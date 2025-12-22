const nextConfig: any = {
  // Ignora errores de ESLint durante el build en Vercel/producción
  eslint: { ignoreDuringBuilds: true },
  // Si alguna vez necesitas ignorar errores de TS en build, descomenta:
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
