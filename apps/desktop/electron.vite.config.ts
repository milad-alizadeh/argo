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
  },
})
