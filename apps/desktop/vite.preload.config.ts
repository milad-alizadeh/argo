import { defineConfig } from 'vite'
import { desktopAlias } from './vite-alias'

export default defineConfig({
  resolve: {
    alias: desktopAlias(import.meta.dirname),
  },
})
