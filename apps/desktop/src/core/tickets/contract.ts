// The version 1 Ticket contract: a Project's Binding to one repository, and that repository's open
// Tickets read through it (CONTEXT.md L1 · Binding, Ticket). Shared by main and renderer, so it
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
  labels: z.array(z.strictObject({ name: z.string(), color: z.string().nullable() })),
  type: z.string().nullable(),
  children: z.array(ticketLink),
  // Null where the provider serves no dependency facts at all, which is not a Ticket nothing blocks.
  blockedBy: z.array(ticketLink).nullable(),
})

// The Account a Binding names may since have been disconnected, revoked or left unreadable, and the
// Binding says so rather than disappearing: reconnecting the same identity brings it back.
const bindingSummary = z.strictObject({
  accountId: identifier,
  login: identifier.nullable(),
  scope: identifier,
  state: z.enum(['ready', 'account-missing', 'account-revoked', 'account-unreadable']),
})

const project = { projectId: identifier }

const bindingRequest = message('ticket.binding', project)
const bindRequest = message('ticket.bind', { ...project, accountId: identifier, scope: identifier })
const unbindRequest = message('ticket.unbind', project)
const listRequest = message('ticket.list', project)
const bound = message('ticket.bound', { ...project, binding: bindingSummary.nullable() })
const listed = message('ticket.listed', { ...project, scope: identifier, tickets: z.array(ticket) })

export type TicketState = z.infer<typeof ticketState>
export type TicketLink = z.infer<typeof ticketLink>
export type TicketLabel = Ticket['labels'][number]
export type Ticket = z.infer<typeof ticket>
export type BindingSummary = z.infer<typeof bindingSummary>
export type BindingState = BindingSummary['state']
export type TicketBindingRequest = z.infer<typeof bindingRequest>
export type TicketBindRequest = z.infer<typeof bindRequest>
export type TicketUnbindRequest = z.infer<typeof unbindRequest>
export type TicketListRequest = z.infer<typeof listRequest>
export type TicketBound = z.infer<typeof bound>
export type TicketListed = z.infer<typeof listed>

export const TICKET_ERRORS = {
  'access-denied': 'Argo cannot read Tickets for this window.',
  'invalid-request': 'The Ticket request is invalid.',
  'unsupported-version': 'This Ticket contract version is not supported.',
  'invalid-response': 'Argo received an invalid Ticket response.',
  'connection-lost': 'The connection to Argo was lost.',
  'missing-project': 'This Project is not registered.',
  'not-bound': 'This Project is not bound to a repository.',
  'invalid-scope': 'Enter a repository as owner/name.',
  'missing-account': 'That GitHub Account is not connected.',
  'account-revoked': 'GitHub no longer accepts this Account. Reconnect it to read Tickets.',
  'repository-not-visible': 'This GitHub Account cannot see that repository.',
  'issues-disabled': 'That repository has GitHub Issues turned off.',
  'rate-limited': 'GitHub is limiting requests. Try again in a few minutes.',
  'github-unreachable': 'Argo cannot reach GitHub.',
  'grant-unreadable': 'Argo cannot read the stored GitHub sign-in. Reconnect the Account.',
  'storage-invalid': 'The Binding store cannot be read in this format.',
  'storage-unavailable': 'Argo cannot access the Binding store.',
  'storage-not-written': 'Argo could not save the Binding.',
} as const

export type TicketErrorCode = keyof typeof TICKET_ERRORS
export type TicketError = ContractError<'ticket.error', TicketErrorCode>
export type TicketBoundReply = TicketBound | TicketError
export type TicketListReply = TicketListed | TicketError

export const ticketError = errorFactory('ticket.error', TICKET_ERRORS)
const ticketErrorSchema = errorSchema('ticket.error', TICKET_ERRORS)

export const isTicketBindingRequest = guard(bindingRequest)
export const isTicketBindRequest = guard(bindRequest)
export const isTicketUnbindRequest = guard(unbindRequest)
export const isTicketListRequest = guard(listRequest)
export const isTicketBoundReply = guard(z.union([bound, ticketErrorSchema]))
export const isTicketListReply = guard(z.union([listed, ticketErrorSchema]))
