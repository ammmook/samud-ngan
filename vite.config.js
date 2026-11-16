import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// เรียก API ผ่านพอร์ตเดียวกับหน้าเว็บ cookie ของ session จึงเป็น same-origin
export default defineConfig({
  plugins: [react()],
  // Host ส่งต่อเป็น localhost:5175 เพื่อให้เซิร์ฟเวอร์เทียบกับ Origin ของเบราว์เซอร์ได้ (ป้องกัน CSRF)
  server: { proxy: { '/api': { target: 'http://localhost:8787', headers: { host: 'localhost:5175' } } } },
});
