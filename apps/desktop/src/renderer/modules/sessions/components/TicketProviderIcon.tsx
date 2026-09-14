import type { ComposerTicketContext } from '../state/useComposerStore'

export const ticketProviderIconSource: Record<ComposerTicketContext['provider'], string> = {
  github: '/provider-icons/github.svg',
  linear: '/provider-icons/linear.svg',
}

export function TicketProviderIcon({ provider }: { provider: ComposerTicketContext['provider'] }) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className="size-4 shrink-0 dark:invert"
      src={ticketProviderIconSource[provider]}
    />
  )
}
