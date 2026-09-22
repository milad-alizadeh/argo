import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: [
    './src/domains/projects/main/schema.ts',
    './src/domains/tickets/main/schema.ts',
    './src/domains/sessions/next/main/schema.ts',
  ],
  out: './drizzle',
})
