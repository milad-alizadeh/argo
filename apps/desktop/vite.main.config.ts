import path from 'node:path'
import { defineConfig } from 'vite'

// node-pty is a native module: it must stay an external require, never be bundled.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  build: {
    rollupOptions: {
      external: ['node-pty'],
    },
  },
})
