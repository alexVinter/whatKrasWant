import { defineConfig } from 'vite'
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
  },
})
