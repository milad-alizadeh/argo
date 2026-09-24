import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: [
    './src/domains/projects/main/schema.ts',
    './src/domains/tickets/main/schema.ts',
    './src/domains/sessions/main/storage/session-table.ts',
  ],
  out: './drizzle',
})
