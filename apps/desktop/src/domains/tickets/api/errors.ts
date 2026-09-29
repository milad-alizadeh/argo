import { PROVIDER_OUTAGE_ERRORS } from '@/domains/accounts/contract/provider-outage'
import { errorFactory, errorSchema } from '@/shared/messages'

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
export const ticketError = errorFactory('ticket.error', TICKET_ERRORS)
export const ticketErrorSchema = errorSchema('ticket.error', TICKET_ERRORS)
