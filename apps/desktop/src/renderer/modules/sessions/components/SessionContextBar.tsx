import { GitFork, Layers3, Minimize2 } from 'lucide-react'

import { Button } from '../../../components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip'
import { ContextPopover } from './ContextPopover'
import { UsagePopover } from './UsagePopover'

const CONTEXT_CAPACITY_TOKENS = 200_000
const WORKING_TARGET_PERCENTAGE = 20

function ContextMeter({ contextAlert, percentage }: { contextAlert: boolean; percentage: number }) {
  const description = contextAlert
    ? 'Dumb zone. Context is crowded and performance may degrade.'
    : 'Context has capacity. Performance should remain stable.'
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="relative hidden min-w-28 flex-1 @[50rem]:block">
              <button
                aria-label={description}
                className="relative block h-2 w-full overflow-hidden rounded-full bg-muted"
                type="button"
              >
                <span
                  className={`absolute inset-y-0 left-0 rounded-full ${contextAlert ? 'bg-gradient-to-r from-white to-red-500' : 'bg-gradient-to-r from-neutral-300 via-neutral-500 to-neutral-900'}`}
                  style={{ width: `${percentage}%` }}
                />
                <span
                  className="absolute -inset-y-(--spacing-hair) w-0.5 bg-foreground"
                  style={{ left: `${WORKING_TARGET_PERCENTAGE}%` }}
                />
              </button>
            </span>
          }
        />
        <TooltipContent className="max-w-none whitespace-nowrap">{description}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function SessionContextBar({
  contextTokens,
  harness,
  isCompacting,
  onCompact,
}: {
  contextTokens: number | null | undefined
  harness: 'claude' | 'codex' | undefined
  isCompacting: boolean
  onCompact?: () => Promise<boolean>
}) {
  const usedTokens = contextTokens ?? 148_000
  const percentage = Math.round((usedTokens / CONTEXT_CAPACITY_TOKENS) * 100)
  const canCompact = onCompact !== undefined
  const contextAlert = percentage >= 40
  const usedTokenSummary = `${Math.round(usedTokens / 1000)}k`

  return (
    <div className="@container relative z-0 mx-(--spacing-shell-gutter) -mt-2 flex min-w-0 select-none items-center gap-2 rounded-b-xl border bg-card px-3 pt-4 pb-2 shadow-lg shadow-foreground/10 @[50rem]:gap-3 @[50rem]:px-4">
      <div className="shrink-0 border-r border-border/60 pr-2 @[50rem]:pr-4">
        <UsagePopover harness={harness ?? 'codex'} />
      </div>
      <div className="shrink-0 @[50rem]:hidden">
        <ContextPopover
          compact
          harness={harness ?? 'codex'}
          percentage={percentage}
          usedTokens={usedTokens}
        />
      </div>
      <div
        className={`hidden shrink-0 items-center gap-1.5 type-label font-medium @[50rem]:flex ${contextAlert ? 'text-red-600' : 'text-foreground'}`}
      >
        <Layers3 className="size-(--size-icon-inline)" />
        Context
      </div>
      <ContextMeter contextAlert={contextAlert} percentage={percentage} />
      <div className="hidden shrink-0 items-center gap-1 type-meta tabular-nums @[50rem]:flex">
        <span className="font-medium text-foreground">{usedTokenSummary}</span>
        <span className="text-muted-foreground"> / 200k</span>
        <span className="font-medium">· {percentage}%</span>
        <ContextPopover
          harness={harness ?? 'codex'}
          percentage={percentage}
          usedTokens={usedTokens}
        />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1 border-l border-border/60 pl-2 @[50rem]:hidden">
        <Button
          aria-label="Compact context"
          disabled={!canCompact || isCompacting}
          onClick={() => void onCompact?.()}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          <Minimize2 />
        </Button>
        <Button
          aria-label="Handoff Session"
          disabled
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <GitFork />
        </Button>
      </div>
      <div className="ml-1 hidden shrink-0 items-center gap-1 border-l border-border/60 pl-4 @[50rem]:flex">
        <Button
          aria-label="Compact context"
          disabled={!canCompact || isCompacting}
          onClick={() => void onCompact?.()}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Minimize2 />
          Compact
        </Button>
        <Button aria-label="Handoff Session" disabled size="sm" type="button" variant="outline">
          <GitFork />
          Handoff
        </Button>
      </div>
    </div>
  )
}
