import { Button, Text } from '@/shared/components/ui'
import type { SessionHeaderModel } from './sessionScreenModel'
import { WorkspaceIdentity } from './WorkspaceIdentity'

export interface SessionHeaderProps extends SessionHeaderModel {
  /** Toggle the Delivery region in and out of the work row (the `split` ↔ `solo` variant). */
  onToggleDelivery: () => void
}

/**
 * Organism (renderer top level): the one header bar of the session panel — the `argo › <title>`
 * breadcrumb, the WorkspaceIdentity chip where a workspace is known, and the Delivery toggle.
 *
 * Composes existing atoms only. The toggle is a single pressed-state Button: pressed means the
 * Delivery region is showing (`variant === 'split'`), so one click hides or restores it.
 */
export function SessionHeader({
  project,
  title,
  workspace,
  variant,
  onToggleDelivery,
}: SessionHeaderProps): React.JSX.Element {
  const deliveryOpen = variant === 'split'
  return (
    <header className="flex items-center gap-gap border-border border-b px-inset py-gap">
      <div className="flex min-w-0 items-center gap-snug">
        <Text variant="row" className="text-muted-foreground">
          {project}
        </Text>
        <Text aria-hidden variant="row" className="text-foreground-faint">
          ›
        </Text>
        <Text variant="row-strong" className="truncate text-foreground">
          {title}
        </Text>
      </div>
      {workspace && <WorkspaceIdentity {...workspace} />}
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={deliveryOpen}
        onClick={onToggleDelivery}
        className="ml-auto"
      >
        <Text variant="meta">Delivery</Text>
      </Button>
    </header>
  )
}
