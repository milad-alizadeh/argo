import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

const require = createRequire(import.meta.url)

export default defineConfig({
  plugins: [react()],
  root: import.meta.dirname,
  server: {
    host: '127.0.0.1',
    port: 5175,
    strictPort: true,
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        dirname(require.resolve('@fontsource-variable/geist/package.json')),
        dirname(require.resolve('@fontsource-variable/geist-mono/package.json')),
      ],
    },
  },
})
