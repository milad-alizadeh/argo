import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { desktopAlias } from './vite-alias'

const developmentPort = Number(process.env.ARGO_DESKTOP_DEV_PORT)
const developmentServer =
  Number.isInteger(developmentPort) && developmentPort >= 1024 && developmentPort <= 65_535
    ? { port: developmentPort, strictPort: true }
    : undefined

// The `@/…` alias is declared in `vite-alias.ts`, `tsconfig.web.json`, and `.storybook/main.ts`.
// The shadcn generator reads the tsconfig copy, and a rename has to move the copies it reads.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      '@codemirror/language',
      '@codemirror/state',
      '@codemirror/view',
      'lexical',
      '@lexical/code',
      '@lexical/link',
      '@lexical/list',
      '@lexical/markdown',
      '@lexical/react',
      '@lexical/rich-text',
      '@lexical/text',
      '@lexical/utils',
    ],
    alias: [
      ...desktopAlias(import.meta.dirname),
      {
        find: /^cn$/,
        replacement: path.resolve(import.meta.dirname, 'src/platform/renderer/lib/utils.ts'),
      },
    ],
  },
  server: developmentServer,
})
