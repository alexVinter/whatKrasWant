import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Dev server listens on WEB_PORT (see .env) so nginx can reverse-proxy to it.
const port = Number(process.env.WEB_PORT) || 5173

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT ?? 3000}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    css: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
