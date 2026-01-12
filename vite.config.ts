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
        manualChunks: (id) => {
          // React 和 React DOM 单独打包
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          // lucide-react 图标库单独打包
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
          // react-transition-group 单独打包
          if (id.includes('node_modules/react-transition-group')) {
            return 'transitions';
          }
          // 其他 node_modules 打包到一起
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 优化构建输出
    minify: 'esbuild',
    // 启用 sourcemap（开发环境）
    sourcemap: process.env.NODE_ENV === 'development',
  },
  server: {
    port: 5173,
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
