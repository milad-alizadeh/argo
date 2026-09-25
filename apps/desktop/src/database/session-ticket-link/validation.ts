import { createSelectSchema } from 'drizzle-orm/zod'
import { sessionTicketLink } from './schema'

export const sessionTicketLinkSelectSchema = createSelectSchema(sessionTicketLink)
