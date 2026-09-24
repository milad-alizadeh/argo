import path from 'node:path'
import { defineConfig } from 'vite'

// node-pty is a native module: it must stay an external require, never be bundled.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  build: {
    lib: {
      entry: {
        main: path.resolve(import.meta.dirname, 'src/main.ts'),
        'claude-sync-worker': path.resolve(
          import.meta.dirname,
          'src/harnesses/claude/session/claude-sync-worker.ts',
        ),
        'codex-sync-worker': path.resolve(
          import.meta.dirname,
          'src/harnesses/codex/session/codex-sync-worker.ts',
        ),
      },
      fileName: (_format, entryName) => `${entryName}.js`,
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['node-pty'],
    },
  },
})
