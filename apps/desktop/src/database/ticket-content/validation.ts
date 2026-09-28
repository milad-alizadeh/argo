import { createSelectSchema } from 'drizzle-orm/zod'
import { ticketContent } from './schema'

export const ticketContentSelectSchema = createSelectSchema(ticketContent)
