import { GitFork, Minimize2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../../../../components/ui/button'

type ContextAction = {
  accessibleName: string
  icon: ReactNode
  label: string
  onClick: (() => Promise<boolean>) | undefined
  disabled: boolean | undefined
  variant: 'outline' | 'secondary'
}

function ContextActionButtons({
  actions,
  labelled,
  size,
}: {
  actions: ContextAction[]
  labelled: boolean
  size: 'icon-sm' | 'sm'
}) {
  return actions.map((action) => (
    <Button
      aria-label={action.accessibleName}
      disabled={action.disabled}
      key={action.label}
      onClick={() => void action.onClick?.()}
      size={size}
      type="button"
      variant={action.variant}
    >
      {action.icon}
      {labelled ? action.label : null}
    </Button>
  ))
}

export function SessionContextActions({
  canCompact,
  canHandoff,
  isCompacting,
  isHandingOff,
  onCompact,
  onHandoff,
}: {
  canCompact: boolean
  canHandoff: boolean
  isCompacting: boolean
  isHandingOff: boolean | undefined
  onCompact: (() => Promise<boolean>) | undefined
  onHandoff: (() => Promise<boolean>) | undefined
}) {
  const actions: [ContextAction, ContextAction] = [
    {
      accessibleName: 'Compact context',
      icon: <Minimize2 />,
      label: 'Compact',
      onClick: onCompact,
      disabled: !canCompact || isCompacting,
      variant: 'secondary' as const,
    },
    {
      accessibleName: 'Handoff Session',
      icon: <GitFork />,
      label: 'Handoff',
      onClick: onHandoff,
      disabled: !canHandoff || isHandingOff,
      variant: 'outline' as const,
    },
  ]
  const [compactAction, handoffAction] = actions
  return (
    <>
      <div className="flex shrink-0 items-center gap-1 @[23rem]:hidden">
        <ContextActionButtons actions={[compactAction]} labelled={false} size="icon-sm" />
      </div>
      <div className="hidden shrink-0 items-center gap-1 @[23rem]:flex">
        <ContextActionButtons actions={[compactAction]} labelled size="sm" />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1 border-l border-border/60 pl-2 @[23rem]:hidden">
        <ContextActionButtons actions={[handoffAction]} labelled={false} size="icon-sm" />
      </div>
      <div className="ml-auto hidden shrink-0 items-center gap-1 border-l border-border/60 pl-4 @[23rem]:flex">
        <ContextActionButtons actions={[handoffAction]} labelled size="sm" />
      </div>
    </>
  )
}
