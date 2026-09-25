import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: [
    './src/database/project-tables.ts',
    './src/database/project/schema.ts',
    './src/database/workspace/schema.ts',
    './src/database/project-workspace-selection/schema.ts',
    './src/database/managed-workspace-recovery/schema.ts',
    './src/database/session/schema.ts',
    './src/database/session-ticket-link/schema.ts',
  ],
  out: './drizzle',
})
