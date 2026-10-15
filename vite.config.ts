import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  clearScreen: false,
  plugins: [svelte()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('/@lucide/svelte/')) {
            return 'icons';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV === 'development',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**', '**/.cache/**', '**/test-results/**'] },
  },
});
