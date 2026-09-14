import { GitBranch } from 'lucide-react'

import type { ComposerTicketContext } from '../state/useComposerStore'

export function TicketProviderIcon({ provider }: { provider: ComposerTicketContext['provider'] }) {
  return provider === 'github' ? (
    <GitBranch aria-hidden="true" className="size-4" />
  ) : (
    <span
      aria-hidden="true"
      className="flex size-4 items-center justify-center rounded-sm bg-primary font-bold text-primary-foreground type-meta"
    >
      L
    </span>
  )
}
