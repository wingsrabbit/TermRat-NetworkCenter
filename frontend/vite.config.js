import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 构建产物输出到 dist/，由后端 Flask 直接静态托管
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
})
