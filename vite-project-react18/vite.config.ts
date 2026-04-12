import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
    // 强制使用单一的 React 实例，解决多个 React 副本导致的 Hook 错误
    // dedupe: ['react', 'react-dom']
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080', // 后端地址
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, '') // 可选，如果后端路径不需要/api前缀，可以去掉
        // 注意：如果后端路径本身就有/api，则不需要rewrite
      }
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      provider: 'v8', reportsDirectory: 'coverage', reporter:['text', 'lcov','json-summary', 'html'],
      exclude: ['/node_modules', '/dist/', '/coverage/', 'src/**/*.d.ts']
    }
  }
})
