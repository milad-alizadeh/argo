// How each Ticket source reads on screen. A view that differs by provider looks it up here, so a
// concept one provider has and another lacks, a Linear cycle say, is one field on its entry.
import type { Provider } from '@/core/accounts/contract'

export type SourcePresentation = {
  // The provider's own page for a new Ticket until Argo writes one (#1850, #1851), or null.
  newTicketURL: ((scope: string) => string) | null
  // The Tickets as the provider calls them, for the sentences that describe a Connection.
  items: string
  scopePlaceholder: string
  noScopes: (login: string) => string
  // What the Detail says when the provider serves no dependency facts for a Ticket.
  noDependencies: string
  // A column wide enough for the provider's keys: `#607`, or `ENG-1234`.
  keyColumn: string
  // The provider's word for a Ticket's status: GitHub's open or closed, Linear's workflow state.
  statusNoun: 'State' | 'Status'
}

export const SOURCE_PRESENTATION: Record<Provider, SourcePresentation> = {
  github: {
    newTicketURL: (scope) => `https://github.com/${scope}/issues/new`,
    items: 'GitHub Issues',
    scopePlaceholder: 'Search owner/name',
    noScopes: (login) => `${login} cannot see any repository with GitHub Issues turned on.`,
    noDependencies: 'GitHub gives no dependency information for this Ticket.',
    keyColumn: 'w-(--size-ticket-key)',
    statusNoun: 'State',
  },
  linear: {
    newTicketURL: null,
    items: 'Linear issues',
    scopePlaceholder: 'Search teams',
    noScopes: (login) => `${login} cannot see any Linear team.`,
    noDependencies: 'Linear gives no dependency information for this Ticket.',
    keyColumn: 'w-(--size-ticket-key-long)',
    statusNoun: 'Status',
  },
}
