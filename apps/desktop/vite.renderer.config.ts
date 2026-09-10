import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The `@/…` alias is declared here and in `tsconfig.web.json`; the shadcn generator reads the
// tsconfig copy, Vite reads this one, and a rename has to move both.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src/renderer') },
  },
})
