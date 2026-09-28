import { createSelectSchema } from 'drizzle-orm/zod'
import { sessionSubagent } from './schema'

export const sessionSubagentSelectSchema = createSelectSchema(sessionSubagent)
