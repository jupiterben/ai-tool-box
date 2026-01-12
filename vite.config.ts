import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

const electronPlugin = electron({
  main: {
    entry: 'electron/main.ts',
    vite: {
      build: {
        outDir: 'dist-electron',
      },
    },
    onstart(args) {
      // 启动 Electron
      if (process.env.VSCODE_DEBUG) {
        console.log('[startup] Electron App');
      } else {
        args.startup();
      }
    },
  },
  preload: {
    input: 'electron/preload.ts',
    vite: {
      build: {
        outDir: 'dist-electron',
      },
    },
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 仅在非 Vercel 构建环境时加载 Electron 插件
    ...(process.env.VERCEL !== '1' ? [
      electronPlugin,
    ] : []),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
