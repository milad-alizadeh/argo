import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: [
    './src/database/project/schema.ts',
    './src/database/workspace/schema.ts',
    './src/database/session/schema.ts',
    './src/database/session/command-schema.ts',
    './src/database/session-sync/schema.ts',
    './src/database/composer-draft/schema.ts',
    './src/database/session-ticket-link/schema.ts',
    './src/database/session-subagent/schema.ts',
    './src/database/ticket/schema.ts',
    './src/database/ticket-content/schema.ts',
    './src/database/ticket-sync/schema.ts',
    './src/database/ticket-search/schema.ts',
    './src/database/ticket-search-ticket-link/schema.ts',
    './src/database/ticket-write-intent/schema.ts',
  ],
  out: './drizzle',
})
