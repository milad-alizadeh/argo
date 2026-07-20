import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src'),
        // The contract's public entry, aliased so renderer files never climb out of
        // their own tree with `../../../` to reach it.
        '@shared': resolve('src/shared/index.ts'),
      },
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        // The `radix-ui` umbrella re-exports ~40 `@radix-ui/react-*` packages, each shipping a
        // top-of-file `"use client"` directive for RSC. Rollup parses them all to read exports
        // (then tree-shakes the unused ones out), warning once per file that it dropped a
        // directive it can't use here. Cosmetic — drop just that code, keep every real warning.
        onwarn(warning, defaultHandler) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
          defaultHandler(warning)
        },
      },
    },
  },
})
