import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // NEON_AUTH_BASE_URL มาจาก `neon deploy` (.env/.env.local) ฝังเข้าหน้าเว็บเป็น VITE_NEON_AUTH_URL
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: { 'import.meta.env.VITE_NEON_AUTH_URL': JSON.stringify(env.NEON_AUTH_BASE_URL || '') },
    // API_PORT ไว้ชี้ไปเซิร์ฟเวอร์ API ที่รันคนละพอร์ต (ค่าเริ่มต้น 8787)
    server: { proxy: { '/api': 'http://localhost:' + (env.API_PORT || 8787) } },
  };
});
