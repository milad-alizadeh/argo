import type { TicketPriority } from '@/domains/tickets/contract/ticket'

// How the renderer draws one provider; shared screens read it by provider ID and never branch on one.
// Reader text sits in the provider's own `locales/en.json`, read through the `providers` namespace.
export type ProviderPresentation = {
  // Decorative: the provider's name always sits beside it.
  icon: string
  // The provider's own page for a new Ticket until Argo writes one (#1850, #1851), or null.
  newTicketURL: ((scope: string) => string) | null
  // A column wide enough for the provider's keys: `#607`, or `ENG-1234`.
  keyColumn: string
  // Which word names a Ticket's status: GitHub's open or closed state, Linear's workflow status.
  statusTerm: 'state' | 'status'
  // The Priorities a Ticket can be moved to, in the provider's words; empty where it keeps none.
  priorityChoices: readonly TicketPriority[]
}
