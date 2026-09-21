import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const developmentPort = Number(process.env.ARGO_DESKTOP_DEV_PORT)
const developmentServer =
  Number.isInteger(developmentPort) && developmentPort >= 1024 && developmentPort <= 65_535
    ? { port: developmentPort, strictPort: true }
    : undefined

// The `@/…` alias is declared here, in `tsconfig.web.json` and in `.storybook/main.ts`; the shadcn
// generator reads the tsconfig copy, Vite reads this one, and a rename has to move all three.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom', '@codemirror/language', '@codemirror/state', '@codemirror/view'],
    alias: [
      { find: '@', replacement: path.resolve(import.meta.dirname, 'src') },
      {
        find: /^cn$/,
        replacement: path.resolve(import.meta.dirname, 'src/platform/renderer/lib/utils.ts'),
      },
    ],
  },
  server: developmentServer,
})
