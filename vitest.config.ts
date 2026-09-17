import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: /@\//,
        replacement: `${resolve(__dirname, 'src')}/`
      }
    ]
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    // src/beauty 下的用例沿用原型仓库的 node:test（见 package.json 的 test:beauty）
    exclude: ['src/beauty/**', '**/node_modules/**'],
    globals: true,
    restoreMocks: true
  }
})
