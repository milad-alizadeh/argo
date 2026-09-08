import { defineConfig } from 'vite'

// node-pty is a native module: it must stay an external require, never be bundled.
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['node-pty'],
    },
  },
})
