import { defineConfig } from 'vite'
import { desktopAlias } from './vite-alias'

// node-pty is a native module: it must stay an external require, never be bundled.
export default defineConfig({
  resolve: {
    alias: desktopAlias(import.meta.dirname),
  },
  build: {
    rollupOptions: {
      external: ['node-pty'],
    },
  },
})
