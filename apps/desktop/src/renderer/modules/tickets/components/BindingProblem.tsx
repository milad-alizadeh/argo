import { Unplug } from 'lucide-react'

import type { BindingSummary } from '@/core/tickets/contract'
import { Button } from '../../../components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'

type Problem = Exclude<BindingSummary['state'], 'ready'>

// The Binding stays when its Account goes, so reconnecting the same identity brings it back.
const TITLES: Record<Problem, (login: string | null) => string> = {
  'account-missing': () => 'The GitHub Account for this Binding is disconnected',
  'account-revoked': (login) => `GitHub no longer accepts ${login ?? 'this Account'}`,
  'account-unreadable': (login) => `Argo cannot read the sign-in for ${login ?? 'this Account'}`,
}

type TroubledBinding = BindingSummary & { state: Problem }

export const isBindingProblem = (binding: BindingSummary): binding is TroubledBinding =>
  binding.state !== 'ready'

export type BindingProblemProps = {
  binding: TroubledBinding
  onReconnect: () => void
  onUnbind: () => void
}

export function BindingProblem({ binding, onReconnect, onUnbind }: BindingProblemProps) {
  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Unplug aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{TITLES[binding.state](binding.login)}</EmptyTitle>
        <EmptyDescription>
          Reconnect it to read <span className="font-mono">{binding.scope}</span> again.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button onClick={onReconnect}>Reconnect GitHub</Button>
        <Button onClick={onUnbind} variant="ghost">
          Unbind
        </Button>
      </EmptyContent>
    </Empty>
  )
}
