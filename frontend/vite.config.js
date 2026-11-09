import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// في التطوير: أي طلب يبدأ بـ /api بيتحوّل للباك إند على بورت 8000 (من غير مشاكل CORS)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // مكتبات ثابتة في ملفات منفصلة: المتصفح بيخزّنها ومابتتحمّلش تاني مع كل تحديث للتطبيق
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
      },
    },
  },
})
