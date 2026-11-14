import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// OSDR and CCMC block browser calls from other sites (CORS), so the dev/preview server forwards them.
// Behind a corporate/VPN proxy, start with NODE_USE_ENV_PROXY=1 (the npm scripts already do).
const proxy = {
  '/api/osdr': { target: 'https://osdr.nasa.gov', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/osdr/, '') },
  '/api/ccmc': { target: 'https://kauai.ccmc.gsfc.nasa.gov', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/ccmc/, '') },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
  base: './', // relative paths: works at username.github.io/<repo>/
  build: { chunkSizeWarningLimit: 1200 },
})
