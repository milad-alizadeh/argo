import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/platform/main/storage/database-schema.ts',
  out: './drizzle',
})
