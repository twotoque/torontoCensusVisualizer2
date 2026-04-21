import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),
    visualizer({
      open: true,            
      filename: 'stats.html', 
      gzipSize: true,       
      brotliSize: true,
    }),],
  server: {
    host: true,
    allowedHosts: ['beta.torontocensusvisualizer.com'],
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
    
  },
  build: {
  rollupOptions: {
    output: {
      manualChunks: {
        "plotly-basic": ["plotly.js-basic-dist-min"],
        "plotly-mapbox": ["plotly.js-mapbox-dist-min"],
      },
    },
  },
},
})
