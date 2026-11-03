import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths keep the build working from /play/ on GitHub Pages.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2048,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
