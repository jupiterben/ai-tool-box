import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// https://vitejs.dev/config/
export default defineConfig({
  // Electron loadFile(file://) 下必须用相对资源路径
  base: './',
  plugins: [svelte()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/svelte')) {
            return 'svelte-vendor';
          }
          if (id.includes('node_modules/@lucide/svelte')) {
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
    watch: {
      ignored: [
        '**/.cache/**',
        '**/.svelte-check/**',
        '**/test-results/**',
        '**/dist-electron/**',
      ],
    },
  },
  optimizeDeps: {
    include: ['svelte', '@lucide/svelte'],
  },
});
