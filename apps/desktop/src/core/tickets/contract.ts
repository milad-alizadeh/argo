// The version 1 Ticket contract: a Project's Connection to one Ticket source, a GitHub repository or a
// Linear team, and that source's open Tickets read through it (CONTEXT.md L1 · Connection, Ticket).
// Shared by main and renderer, so it imports neither Electron nor Node.
import { z } from 'zod'
import { displayName, provider } from '../accounts/contract'
import {
  type ContractError,
  errorFactory,
  errorSchema,
  guard,
  identifier,
  message,
} from '../contract/messages'
import { statusId, ticket, ticketKey, ticketStatus } from './ticket'

export type {
  Ticket,
  TicketLabel,
  TicketLink,
  TicketPriority,
  TicketState,
  TicketStatus,
} from './ticket'

export const TICKET_CHANNEL = 'argo:ticket'

// One screenful: small enough that its edge reads land before a person scrolls to the next.
export const TICKET_PAGE_SIZE = 25

// The Account a Connection names may since have been disconnected, left to expire, revoked or left
// unreadable, and the Connection says so rather than disappearing: reconnecting the same identity
// brings it back. `scope` is the provider's id for the source and `label` what a person reads.
const connectionSummary = z.strictObject({
  accountId: identifier,
  provider,
  login: displayName.nullable(),
  scope: identifier,
  label: z.string(),
  state: z.enum([
    'ready',
    'account-missing',
    'account-expired',
    'account-revoked',
    'account-unreadable',
  ]),
})

const project = { projectId: identifier }

const connectionRequest = message('ticket.connection', project)
const connectSourceRequest = message('ticket.connect', {
  ...project,
  accountId: identifier,
  scope: identifier,
})
const disconnectSourceRequest = message('ticket.disconnect', project)
// The repositories or teams an Account could connect this Project to.
const discoverRequest = message('ticket.discover', { ...project, accountId: identifier })
// GitHub refuses a search query over 256 characters, and the scope qualifiers take their share.
export const TICKET_QUERY_LIMIT = 200
// The provider's own opaque place in a listing: a GitHub page number, a Linear end cursor.
const cursor = z.string().min(1).max(512)
// An empty query reads the open backlog in the provider's order; any other searches it there.
const listRequest = message('ticket.list', {
  ...project,
  query: z.string().max(TICKET_QUERY_LIMIT),
  cursor: cursor.nullable(),
})
// Moves one Ticket to one of the statuses its listing offered.
const updateRequest = message('ticket.update', { ...project, key: ticketKey, statusId })
const connected = message('ticket.connected', {
  ...project,
  connection: connectionSummary.nullable(),
})
const discovered = message('ticket.discovered', {
  ...project,
  scopes: z.array(z.strictObject({ scope: identifier, label: z.string() })),
})
// `total` is known only for a search: neither provider counts a backlog without paging it all.
const listed = message('ticket.listed', {
  ...project,
  scope: identifier,
  tickets: z.array(ticket),
  // Every status a Ticket here can move to, in the provider's order.
  statuses: z.array(ticketStatus),
  nextCursor: cursor.nullable(),
  total: z.int().nonnegative().nullable(),
})
const updated = message('ticket.updated', { ...project, key: ticketKey, status: ticketStatus })

export type ConnectionSummary = z.infer<typeof connectionSummary>
export type ConnectionState = ConnectionSummary['state']
export type TicketConnectionRequest = z.infer<typeof connectionRequest>
export type TicketConnectRequest = z.infer<typeof connectSourceRequest>
export type TicketDisconnectRequest = z.infer<typeof disconnectSourceRequest>
export type TicketListRequest = z.infer<typeof listRequest>
export type TicketUpdateRequest = z.infer<typeof updateRequest>
export type TicketUpdated = z.infer<typeof updated>
export type TicketDiscoverRequest = z.infer<typeof discoverRequest>
export type TicketDiscovered = z.infer<typeof discovered>
export type TicketScope = TicketDiscovered['scopes'][number]
export type TicketConnected = z.infer<typeof connected>
export type TicketListed = z.infer<typeof listed>

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

export const ticketError = errorFactory('ticket.error', TICKET_ERRORS)
const ticketErrorSchema = errorSchema('ticket.error', TICKET_ERRORS)

export const isTicketConnectionRequest = guard(connectionRequest)
export const isTicketConnectRequest = guard(connectSourceRequest)
export const isTicketDisconnectRequest = guard(disconnectSourceRequest)
export const isTicketListRequest = guard(listRequest)
export const isTicketDiscoverRequest = guard(discoverRequest)
export const isTicketUpdateRequest = guard(updateRequest)
export const isTicketConnectedReply = guard(z.union([connected, ticketErrorSchema]))
export const isTicketListReply = guard(z.union([listed, ticketErrorSchema]))
export const isTicketDiscoverReply = guard(z.union([discovered, ticketErrorSchema]))
export const isTicketUpdateReply = guard(z.union([updated, ticketErrorSchema]))
