import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: [
    './src/database/project/schema.ts',
    './src/database/workspace/schema.ts',
    './src/database/session/schema.ts',
    './src/database/session-sync/schema.ts',
    './src/database/composer-draft/schema.ts',
    './src/database/session-ticket-link/schema.ts',
  ],
  out: './drizzle',
})
