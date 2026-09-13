import { TriangleAlert } from 'lucide-react'
import { useRef } from 'react'

import type { BindingSummary } from '@/core/tickets/contract'
import { Alert, AlertDescription } from '../../../components/ui/alert'
import { Button } from '../../../components/ui/button'
import { useFocusRescue } from '../../../lib/focus-rescue'
import type { ContractFailure } from '../../../lib/query-client'
import { BindingStatusMark } from './BindingStatusMark'

export type RepositorySettingsProps = {
  // Undefined while the Binding is read; null when the Project has none.
  binding: BindingSummary | null | undefined
  error: ContractFailure | null
  disconnecting: boolean
  onDisconnect: () => void
  onConnect: () => void
}

function Repository({ binding, disconnecting, onDisconnect, onConnect }: RepositorySettingsProps) {
  if (binding === undefined) {
    return (
      <p className="type-meta text-muted-foreground" role="status">
        Reading the connected repository…
      </p>
    )
  }
  if (binding === null) {
    return (
      <div className="flex items-center gap-(--spacing-shell-gutter)">
        <p className="min-w-0 flex-1 type-body text-muted-foreground">
          No repository is connected.
        </p>
        <Button onClick={onConnect} size="sm" variant="outline">
          Connect a repository
        </Button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-(--spacing-shell-gutter) rounded-lg border border-border/60 px-(--spacing-shell-gutter) py-(--spacing-shell-item)">
      <div className="grid min-w-0 flex-1 gap-(--spacing-shell-tight)">
        <span className="truncate type-body font-medium">{binding.scope}</span>
        <span className="flex items-center gap-(--spacing-shell-icon) type-meta text-muted-foreground">
          <BindingStatusMark state={binding.state}>
            Read through {binding.login ?? 'a disconnected Account'}
          </BindingStatusMark>
        </span>
      </div>
      <Button disabled={disconnecting} onClick={onDisconnect} size="sm" variant="outline">
        Disconnect repository
      </Button>
    </div>
  )
}

// The one GitHub repository a Project reads its Tickets from (CONTEXT.md · Binding).
export function RepositorySettings(props: RepositorySettingsProps) {
  const section = useRef<HTMLElement>(null)
  // Disconnecting removes the control that did it.
  useFocusRescue(section, props.binding === null)
  return (
    <section aria-label="Repository" className="grid gap-(--spacing-shell-item)" ref={section}>
      <h3 className="type-label text-muted-foreground">Repository</h3>
      <Repository {...props} />
      {props.error ? (
        <Alert className="border-destructive/50 bg-destructive/10" variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>{props.error.message}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
