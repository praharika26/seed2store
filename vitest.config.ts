import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    include: ['test/**/*.test.ts', 'lib/**/*.test.ts'],
  },
  resolve: {
    alias: {
      'server-only': resolve(__dirname, './test/stubs/server-only.ts'),
      '@': resolve(__dirname, './'),
      '@/lib': resolve(__dirname, './lib'),
      '@/components': resolve(__dirname, './components'),
    },
  },
})