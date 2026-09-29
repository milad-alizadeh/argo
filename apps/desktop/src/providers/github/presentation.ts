import type { ProviderPresentation } from '@/providers/presentation'

export const githubPresentation: ProviderPresentation = {
  icon: '/provider-icons/github.svg',
  newTicketURL: (scope) => `https://github.com/${scope}/issues/new`,
  keyColumn: 'w-(--size-ticket-key)',
  statusTerm: 'state',
  hasPriority: false,
}
