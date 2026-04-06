import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  // mapbox-gl v3 ships as ESM — no special exclusion needed.
  // Keeping this explicit for clarity.
  optimizeDeps: {
    include: ['mapbox-gl', '@mapbox/mapbox-gl-draw'],
  },
  build: {
    // Increase chunk warning limit (mapbox-gl is large by design)
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: {
          'mapbox-vendor': ['mapbox-gl', '@mapbox/mapbox-gl-draw'],
          'chart-vendor': ['chart.js', 'react-chartjs-2'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
