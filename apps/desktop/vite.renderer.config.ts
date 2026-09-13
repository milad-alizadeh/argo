import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The `@/…` alias is declared here, in `tsconfig.web.json` and in `.storybook/main.ts`; the shadcn
// generator reads the tsconfig copy, Vite reads this one, and a rename has to move all three.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
})
