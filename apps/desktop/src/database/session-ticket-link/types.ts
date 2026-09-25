import type { sessionTicketLink } from './schema'

export type SessionTicketLinkRow = typeof sessionTicketLink.$inferSelect
export type NewSessionTicketLink = typeof sessionTicketLink.$inferInsert
