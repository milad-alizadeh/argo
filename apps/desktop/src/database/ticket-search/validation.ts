import { createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { TICKET_SEARCH_PHASES, ticketSearch } from './schema'

export const ticketSearchSelectSchema = createSelectSchema(ticketSearch)

// What the Ticket screen learns of a query's provider search: `idle` before one was asked for, and
// `completedAt` once one committed, which a retry after it keeps.
export const ticketSearchStateSchema = ticketSearchSelectSchema
  .pick({ failure: true, completedAt: true })
  .extend({ phase: z.enum(['idle', ...TICKET_SEARCH_PHASES]) })
  .strict()

export type TicketSearchState = z.infer<typeof ticketSearchStateSchema>
