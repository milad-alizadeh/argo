// How each Ticket source reads on screen. A view that differs by provider looks it up here, so a
// concept one provider has and another lacks, a Linear cycle say, is one field on its entry.
import type { Provider } from '@/domains/accounts/contract/contract'
import { i18n } from '@/platform/renderer/i18n/i18n'

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
  statusNoun: string
  // Whether the provider carries a Priority a Ticket can hold.
  hasPriority: boolean
}

// Neither a URL builder nor a CSS token is user-facing text, so both stay static per provider.
const STATIC: Record<
  Provider,
  {
    newTicketURL: SourcePresentation['newTicketURL']
    keyColumn: string
    hasPriority: boolean
    statusNounKey: 'tickets:status.noun.state' | 'tickets:status.noun.status'
  }
> = {
  github: {
    newTicketURL: (scope) => `https://github.com/${scope}/issues/new`,
    keyColumn: 'w-(--size-ticket-key)',
    hasPriority: false,
    statusNounKey: 'tickets:status.noun.state',
  },
  linear: {
    newTicketURL: null,
    keyColumn: 'w-(--size-ticket-key-long)',
    hasPriority: true,
    statusNounKey: 'tickets:status.noun.status',
  },
}

// Read on call rather than built once at import, so it answers in the current language (#2130), as
// `providerPresentation` does.
export function sourcePresentation(provider: Provider): SourcePresentation {
  return {
    ...STATIC[provider],
    items: i18n.t(`tickets:source.${provider}.items`),
    scopePlaceholder: i18n.t(`tickets:source.${provider}.scopePlaceholder`),
    noScopes: (login) => i18n.t(`tickets:source.${provider}.noScopes`, { login }),
    noDependencies: i18n.t(`tickets:source.${provider}.noDependencies`),
    statusNoun: i18n.t(STATIC[provider].statusNounKey),
  }
}
