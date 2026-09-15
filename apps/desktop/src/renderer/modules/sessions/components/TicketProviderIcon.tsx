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
      className="mt-0.5 size-4 shrink-0 self-start dark:invert"
      src={ticketProviderIconSource[provider]}
    />
  )
}
