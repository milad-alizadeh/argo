// The version 1 Ticket contract: a Project's Connection to one Ticket source, a GitHub repository or a
// Linear team, and that source's open Tickets read through it (CONTEXT.md L1 · Connection, Ticket).
// Shared by main and renderer, so it imports neither Electron nor Node.
import { z } from 'zod'
import { displayName, provider } from '@/domains/accounts/contract/contract'
import {
  type ContractError,
  errorFactory,
  errorSchema,
  identifier,
  message,
} from '@/shared/messages'
import { priorityLevel, statusId, ticket, ticketKey, ticketPriority, ticketStatus } from './ticket'

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

const project = { projectId: identifier }

export const ticketConnectionRequestSchema = message('ticket.connection', project)
export const ticketConnectRequestSchema = message('ticket.connect', {
  ...project,
  accountId: identifier,
  scope: identifier,
})
export const ticketDisconnectRequestSchema = message('ticket.disconnect', project)
// The repositories or teams an Account could connect this Project to.
export const ticketDiscoverRequestSchema = message('ticket.discover', {
  ...project,
  accountId: identifier,
})
// GitHub refuses a search query over 256 characters, and the scope qualifiers take their share.
export const TICKET_QUERY_LIMIT = 200
// The provider's own opaque place in a listing: a GitHub page number, a Linear end cursor.
const cursor = z.string().min(1).max(512)
// An empty query reads the open backlog in the provider's order; any other searches it there.
export const ticketListRequestSchema = message('ticket.list', {
  ...project,
  query: z.string().max(TICKET_QUERY_LIMIT),
  cursor: cursor.nullable(),
})
// Moves one Ticket to one of the statuses its listing offered.
export const ticketUpdateRequestSchema = message('ticket.update', {
  ...project,
  key: ticketKey,
  statusId,
})
// Moves one Ticket to another priority level, or to none.
export const ticketPriorityRequestSchema = message('ticket.priority', {
  ...project,
  key: ticketKey,
  priorityLevel: priorityLevel.nullable(),
})
export const ticketConnectedSchema = message('ticket.connected', {
  ...project,
  connection: connectionSummary.nullable(),
})
export const ticketDiscoveredSchema = message('ticket.discovered', {
  ...project,
  scopes: z.array(z.strictObject({ scope: identifier, label: z.string() })),
})
// `total` is known only for a search: neither provider counts a backlog without paging it all.
export const ticketListedSchema = message('ticket.listed', {
  ...project,
  scope: identifier,
  tickets: z.array(ticket),
  // Every status a Ticket here can move to, in the provider's order.
  statuses: z.array(ticketStatus),
  nextCursor: cursor.nullable(),
  total: z.int().nonnegative().nullable(),
})
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

export type ConnectionSummary = z.infer<typeof connectionSummary>
export type ConnectionState = ConnectionSummary['state']
export type TicketConnectionRequest = z.infer<typeof ticketConnectionRequestSchema>
export type TicketConnectRequest = z.infer<typeof ticketConnectRequestSchema>
export type TicketDisconnectRequest = z.infer<typeof ticketDisconnectRequestSchema>
export type TicketListRequest = z.infer<typeof ticketListRequestSchema>
export type TicketUpdateRequest = z.infer<typeof ticketUpdateRequestSchema>
export type TicketUpdated = z.infer<typeof ticketUpdatedSchema>
export type TicketPriorityRequest = z.infer<typeof ticketPriorityRequestSchema>
export type TicketPrioritized = z.infer<typeof ticketPrioritizedSchema>
export type TicketDiscoverRequest = z.infer<typeof ticketDiscoverRequestSchema>
export type TicketDiscovered = z.infer<typeof ticketDiscoveredSchema>
export type TicketScope = TicketDiscovered['scopes'][number]
export type TicketConnected = z.infer<typeof ticketConnectedSchema>
export type TicketListed = z.infer<typeof ticketListedSchema>

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
  'ticket-not-writable': 'This Account is not allowed to change that Ticket.',
  'status-unknown': 'That status is not one this Ticket can move to.',
  'rate-limited': 'GitHub is limiting requests. Try again in a few minutes.',
  'github-unreachable': 'Argo cannot reach GitHub.',
  'linear-rate-limited': 'Linear is limiting requests. Try again in a few minutes.',
  'linear-unreachable': 'Argo cannot reach Linear.',
  'grant-unreadable': 'Argo cannot read the stored sign-in. Reconnect the Account.',
  'storage-invalid': 'The store of connected Ticket sources cannot be read in this format.',
  'storage-unavailable': 'Argo cannot access the store of connected Ticket sources.',
  'storage-not-written': 'Argo could not save the connected Ticket source.',
} as const

export type TicketErrorCode = keyof typeof TICKET_ERRORS
export type TicketError = ContractError<'ticket.error', TicketErrorCode>
export type TicketConnectedReply = TicketConnected | TicketError
export type TicketListReply = TicketListed | TicketError
export type TicketDiscoverReply = TicketDiscovered | TicketError
export type TicketUpdateReply = TicketUpdated | TicketError
export type TicketPriorityReply = TicketPrioritized | TicketError

export const ticketError = errorFactory('ticket.error', TICKET_ERRORS)
export const ticketErrorSchema = errorSchema('ticket.error', TICKET_ERRORS)
