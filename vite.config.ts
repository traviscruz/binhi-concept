import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { emailPlugin } from './src/server/emailPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    emailPlugin(),
  ],
  server: {
    proxy: {
      '/paymongo-api': {
        target: 'https://api.paymongo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/paymongo-api/, ''),
      },
    },
  },
})
