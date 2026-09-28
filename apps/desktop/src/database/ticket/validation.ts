import { createSelectSchema } from 'drizzle-orm/zod'
import type { z } from 'zod'
import { ticketTable } from './schema'

export const ticketSelectSchema = createSelectSchema(ticketTable)
// A provider scope: the space a Ticket's native ID is unique within.
export const ticketScopeSchema = ticketSelectSchema.pick({ provider: true, scope: true })
export type TicketScopeTarget = z.infer<typeof ticketScopeSchema>
