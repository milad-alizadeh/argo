import type { ComposerTicketContext } from '@/domains/sessions/renderer/composer/use-composer-store'

export const ticketProviderIconSource: Record<ComposerTicketContext['provider'], string> = {
  github: '/provider-icons/github.svg',
  linear: '/provider-icons/linear.svg',
}

export function TicketProviderIcon({ provider }: { provider: ComposerTicketContext['provider'] }) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className="size-3.5 shrink-0 dark:invert"
      src={ticketProviderIconSource[provider]}
    />
  )
}
