import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
        // Preserve the original Host header for subdomain detection
        // The backend uses the Host header to determine organization context
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Forward the original host header to backend via X-Forwarded-Host
            const originalHost = req.headers.host
            if (originalHost) {
              proxyReq.setHeader('X-Forwarded-Host', originalHost)
              // Also set the Host header directly to the original
              proxyReq.setHeader('Host', originalHost)
            }
          })
        }
      }
    }
  }
})
