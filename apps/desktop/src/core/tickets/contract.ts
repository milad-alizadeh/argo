// The version 1 Ticket contract: a Project's Connection to one repository, and that repository's open
// Tickets read through it (CONTEXT.md L1 · Connection, Ticket). Shared by main and renderer, so it
// imports neither Electron nor Node.
import { z } from 'zod'
import {
  type ContractError,
  errorFactory,
  errorSchema,
  guard,
  identifier,
  message,
} from '../contract/messages'

export const TICKET_CHANNEL = 'argo:ticket'

const ticketState = z.enum(['open', 'closed'])
const ticketLink = z.strictObject({
  number: z.int().positive(),
  title: z.string(),
  state: ticketState,
})

const ticket = z.strictObject({
  number: z.int().positive(),
  title: z.string(),
  body: z.string().nullable(),
  state: ticketState,
  stateReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  labels: z.array(z.strictObject({ name: z.string(), color: z.string().nullable() })),
  type: z.string().nullable(),
  children: z.array(ticketLink),
  // Null where the provider serves no dependency facts at all, which is not a Ticket nothing blocks.
  blockedBy: z.array(ticketLink).nullable(),
})

// The Account a Connection names may since have been disconnected, revoked or left unreadable, and the
// Connection says so rather than disappearing: reconnecting the same identity brings it back.
const connectionSummary = z.strictObject({
  accountId: identifier,
  login: identifier.nullable(),
  scope: identifier,
  state: z.enum(['ready', 'account-missing', 'account-revoked', 'account-unreadable']),
})

const project = { projectId: identifier }

const connectionRequest = message('ticket.connection', project)
const connectRepositoryRequest = message('ticket.connect', {
  ...project,
  accountId: identifier,
  scope: identifier,
})
const disconnectRepositoryRequest = message('ticket.disconnect', project)
// The repositories an Account could connect this Project to.
const discoverRequest = message('ticket.discover', { ...project, accountId: identifier })
// GitHub refuses a search query over 256 characters, and the scope qualifiers take their share.
export const TICKET_QUERY_LIMIT = 200
// An empty query reads the open backlog in GitHub's order; any other searches it on GitHub.
const listRequest = message('ticket.list', {
  ...project,
  query: z.string().max(TICKET_QUERY_LIMIT),
  page: z.int().positive(),
})
const connected = message('ticket.connected', {
  ...project,
  connection: connectionSummary.nullable(),
})
const discovered = message('ticket.discovered', { ...project, scopes: z.array(identifier) })
// `total` is known only for a search: GitHub counts a backlog listing nowhere without paging it all.
const listed = message('ticket.listed', {
  ...project,
  scope: identifier,
  tickets: z.array(ticket),
  nextPage: z.int().positive().nullable(),
  total: z.int().nonnegative().nullable(),
})

export type TicketState = z.infer<typeof ticketState>
export type TicketLink = z.infer<typeof ticketLink>
export type TicketLabel = Ticket['labels'][number]
export type Ticket = z.infer<typeof ticket>
export type ConnectionSummary = z.infer<typeof connectionSummary>
export type ConnectionState = ConnectionSummary['state']
export type TicketConnectionRequest = z.infer<typeof connectionRequest>
export type TicketConnectRequest = z.infer<typeof connectRepositoryRequest>
export type TicketDisconnectRequest = z.infer<typeof disconnectRepositoryRequest>
export type TicketListRequest = z.infer<typeof listRequest>
export type TicketDiscoverRequest = z.infer<typeof discoverRequest>
export type TicketDiscovered = z.infer<typeof discovered>
export type TicketConnected = z.infer<typeof connected>
export type TicketListed = z.infer<typeof listed>

export const TICKET_ERRORS = {
  'access-denied': 'Argo cannot read Tickets for this window.',
  'invalid-request': 'The Ticket request is invalid.',
  'unsupported-version': 'This Ticket contract version is not supported.',
  'invalid-response': 'Argo received an invalid Ticket response.',
  'connection-lost': 'The connection to Argo was lost.',
  'missing-project': 'This Project is not registered.',
  'not-connected': 'This Project has no connected repository.',
  'invalid-scope': 'Enter a repository as owner/name.',
  'missing-account': 'That GitHub Account is not connected.',
  'account-revoked': 'GitHub no longer accepts this Account. Reconnect it to read Tickets.',
  'repository-not-visible': 'This GitHub Account cannot see that repository.',
  'issues-disabled': 'That repository has GitHub Issues turned off.',
  'rate-limited': 'GitHub is limiting requests. Try again in a few minutes.',
  'github-unreachable': 'Argo cannot reach GitHub.',
  'grant-unreadable': 'Argo cannot read the stored GitHub sign-in. Reconnect the Account.',
  'storage-invalid': 'The store of connected repositories cannot be read in this format.',
  'storage-unavailable': 'Argo cannot access the store of connected repositories.',
  'storage-not-written': 'Argo could not save the connected repository.',
} as const

export type TicketErrorCode = keyof typeof TICKET_ERRORS
export type TicketError = ContractError<'ticket.error', TicketErrorCode>
export type TicketConnectedReply = TicketConnected | TicketError
export type TicketListReply = TicketListed | TicketError
export type TicketDiscoverReply = TicketDiscovered | TicketError

export const ticketError = errorFactory('ticket.error', TICKET_ERRORS)
const ticketErrorSchema = errorSchema('ticket.error', TICKET_ERRORS)

export const isTicketConnectionRequest = guard(connectionRequest)
export const isTicketConnectRequest = guard(connectRepositoryRequest)
export const isTicketDisconnectRequest = guard(disconnectRepositoryRequest)
export const isTicketListRequest = guard(listRequest)
export const isTicketDiscoverRequest = guard(discoverRequest)
export const isTicketConnectedReply = guard(z.union([connected, ticketErrorSchema]))
export const isTicketListReply = guard(z.union([listed, ticketErrorSchema]))
export const isTicketDiscoverReply = guard(z.union([discovered, ticketErrorSchema]))
