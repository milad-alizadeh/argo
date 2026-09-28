import { createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { ticketSync } from './schema'

export const ticketSyncSelectSchema = createSelectSchema(ticketSync)

// What the Ticket screen learns of a scope's scan: its phase, and whether any scan read every page.
export const ticketSyncStateSchema = ticketSyncSelectSchema
  .pick({ phase: true, failure: true, completedAt: true })
  .extend({ complete: z.boolean() })
  .strict()

export type TicketSyncState = z.infer<typeof ticketSyncStateSchema>
