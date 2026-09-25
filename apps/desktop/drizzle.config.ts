import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: [
    './src/database/project-tables.ts',
    './src/database/ticket-tables.ts',
    './src/database/session-table.ts',
  ],
  out: './drizzle',
})
