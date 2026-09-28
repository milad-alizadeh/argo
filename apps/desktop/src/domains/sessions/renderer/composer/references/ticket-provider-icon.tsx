import { PROVIDER_PRESENTATIONS } from '@/providers/presentation-registry'
import type { ComposerTicketContext } from '../editing/composer-editing'

export function TicketProviderIcon({ provider }: { provider: ComposerTicketContext['provider'] }) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className="size-3.5 shrink-0 dark:invert"
      src={PROVIDER_PRESENTATIONS[provider].icon}
    />
  )
}
