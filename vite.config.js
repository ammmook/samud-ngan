import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // NEON_AUTH_BASE_URL มาจาก `neon deploy` (.env/.env.local) ฝังเข้าหน้าเว็บเป็น VITE_NEON_AUTH_URL
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: { 'import.meta.env.VITE_NEON_AUTH_URL': JSON.stringify(env.NEON_AUTH_BASE_URL || '') },
    server: { proxy: { '/api': 'http://localhost:8787' } },
  };
});
