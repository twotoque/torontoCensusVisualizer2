import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),
    visualizer({
      open: true,            // This opens the report in your browser automatically
      filename: 'stats.html', // The name of the file it generates
      gzipSize: true,        // Shows you what the size will be when compressed
      brotliSize: true,
    }),],
  server: {
    proxy: {
      '/api': {
        target: 'http://api:8000', 
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
