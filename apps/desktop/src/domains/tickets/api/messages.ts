// The version 1 Ticket contract: a Project's Connection to one Ticket source, a GitHub repository or a
// Linear team, and that source's open Tickets read through it (CONTEXT.md L1 · Connection, Ticket).
// Shared by main and renderer, so it imports neither Electron nor Node.
import { z } from 'zod'
import { displayName, provider } from '@/domains/accounts/contract/contract'
import { PROVIDER_OUTAGE_ERRORS } from '@/domains/accounts/contract/provider-outage'
import {
  type ContractError,
  errorFactory,
  errorSchema,
  identifier,
  message,
} from '@/shared/messages'
import { ticketKey, ticketPriority, ticketStatus } from './ticket'

export type {
  Ticket,
  TicketLabel,
  TicketLink,
  TicketPriority,
  TicketState,
  TicketStatus,
} from './ticket'

// One screenful: small enough that its edge reads land before a person scrolls to the next.
export const TICKET_PAGE_SIZE = 25

// Every state a Connection's Account can leave it in, `ready` included. The renderer's i18n
// catalog is keyed by this same set (#2130), so a state added here fails its parity test until
// the catalog answers for it too.
export const CONNECTION_STATES = [
  'ready',
  'account-missing',
  'account-expired',
  'account-revoked',
  'account-unreadable',
] as const

// The Account a Connection names may since have been disconnected, left to expire, revoked or left
// unreadable, and the Connection says so rather than disappearing: reconnecting the same identity
// brings it back. `scope` is the provider's id for the source and `label` what a person reads.
const connectionSummary = z.strictObject({
  accountId: identifier,
  provider,
  login: displayName.nullable(),
  scope: identifier,
  label: z.string(),
  state: z.enum(CONNECTION_STATES),
})

// GitHub refuses a search query over 256 characters, and the scope qualifiers take their share.
export const TICKET_QUERY_LIMIT = 200
const project = { projectId: identifier }

export const ticketConnectedSchema = message('ticket.connected', {
  ...project,
  connection: connectionSummary.nullable(),
})
export const ticketDiscoveredSchema = message('ticket.discovered', {
  ...project,
  scopes: z.array(z.strictObject({ scope: identifier, label: z.string() })),
})
// `total` is known only for a search: neither provider counts a backlog without paging it all.
export const ticketUpdatedSchema = message('ticket.updated', {
  ...project,
  key: ticketKey,
  status: ticketStatus,
})
export const ticketPrioritizedSchema = message('ticket.prioritized', {
  ...project,
  key: ticketKey,
  priority: ticketPriority.nullable(),
})

// The priority levels the Connection's provider offers now, in its words; none where it keeps none.
export const ticketPriorityChoicesSchema = message('ticket.priorityChoices', {
  ...project,
  choices: z.array(ticketPriority),
})

export type ConnectionSummary = z.infer<typeof connectionSummary>
export type ConnectionState = ConnectionSummary['state']
export type TicketUpdated = z.infer<typeof ticketUpdatedSchema>
export type TicketPrioritized = z.infer<typeof ticketPrioritizedSchema>
export type TicketPriorityChoices = z.infer<typeof ticketPriorityChoicesSchema>
export type TicketDiscovered = z.infer<typeof ticketDiscoveredSchema>
export type TicketScope = TicketDiscovered['scopes'][number]
export type TicketConnected = z.infer<typeof ticketConnectedSchema>

export const TICKET_ERRORS = {
  'access-denied': 'Argo cannot read Tickets for this window.',
  'invalid-request': 'The Ticket request is invalid.',
  'unsupported-version': 'This Ticket contract version is not supported.',
  'invalid-response': 'Argo received an invalid Ticket response.',
  'connection-lost': 'The connection to Argo was lost.',
  'missing-project': 'This Project is not registered.',
  'not-connected': 'This Project has no connected Ticket source.',
  'invalid-scope': 'Enter a repository as owner/name.',
  'missing-account': 'That Account is not connected.',
  'account-expired':
    'This Account’s sign-in expired and could not be renewed. Reconnect it to read Tickets.',
  'account-revoked': 'This Account’s sign-in is no longer accepted. Reconnect it to read Tickets.',
  'repository-not-visible': 'This GitHub Account cannot see that repository.',
  'issues-disabled': 'That repository has GitHub Issues turned off.',
  'team-not-visible': 'This Linear Account cannot see that team.',
  'ticket-not-found': 'That Ticket is no longer in this repository or team.',
  'ticket-deleted': 'That Ticket was deleted.',
  'ticket-not-writable': 'This Account is not allowed to change that Ticket.',
  'status-unknown': 'That status is not one this Ticket can move to.',
  ...PROVIDER_OUTAGE_ERRORS,
  'grant-unreadable': 'Argo cannot read the stored sign-in. Reconnect the Account.',
  'storage-invalid': 'The store of connected Ticket sources cannot be read in this format.',
  'storage-unavailable': 'Argo cannot access the store of connected Ticket sources.',
  'storage-not-written': 'Argo could not save the connected Ticket source.',
} as const

export type TicketErrorCode = keyof typeof TICKET_ERRORS
export type TicketError = ContractError<'ticket.error', TicketErrorCode>
export type TicketConnectedReply = TicketConnected | TicketError
export type TicketDiscoverReply = TicketDiscovered | TicketError
export type TicketUpdateReply = TicketUpdated | TicketError
export type TicketPriorityReply = TicketPrioritized | TicketError
export type TicketPriorityChoicesReply = TicketPriorityChoices | TicketError

export const ticketError = errorFactory('ticket.error', TICKET_ERRORS)
export const ticketErrorSchema = errorSchema('ticket.error', TICKET_ERRORS)
