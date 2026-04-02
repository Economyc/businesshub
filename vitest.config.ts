import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/modules/**/hooks.ts', 'src/modules/**/services.ts'],
      exclude: ['src/test/**', 'src/**/*.test.*', 'src/components/ui/**'],
    },
    css: false,
  },
}))
