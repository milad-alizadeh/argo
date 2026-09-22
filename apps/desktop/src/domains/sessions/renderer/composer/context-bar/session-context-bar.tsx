import { ContextPopover } from '../context-window/context-popover'
import { useTranslation } from 'react-i18next'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/platform/renderer/components/ui/tooltip'
import { SessionContextActions } from './session-context-actions'
import { UsagePopover } from './usage-popover'

const WORKING_TARGET_PERCENTAGE = 20

function ContextMeter({
  contextAlert,
  percentage,
}: {
  contextAlert: boolean
  percentage: number | null
}) {
  if (percentage === null) return null
  const description = contextAlert
    ? 'Dumb zone. Context is crowded and performance may degrade.'
    : 'Context has capacity. Performance should remain stable.'
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="relative hidden min-w-28 flex-1 @[56rem]:block">
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

function ContextSummary({
  percentage,
  usedTokens,
}: {
  percentage: number | null
  usedTokens: number
}) {
  const { t } = useTranslation('sessions')
  return (
    <div className="hidden shrink-0 items-center gap-1 type-meta tabular-nums @[56rem]:flex">
      <span className="font-medium text-foreground">
        {t('composer.contextWindow.tokenCount', { count: Math.round(usedTokens / 1000) })}
      </span>
      {percentage === null ? (
        <span className="text-muted-foreground"> {t('composer.contextWindow.tokens')}</span>
      ) : (
        <span className="font-medium">· {percentage}%</span>
      )}
    </div>
  )
}

export function SessionContextBar({
  contextTokens,
  contextWindowTokens,
  harness,
  isCompacting,
  isHandingOff,
  onCompact,
  onHandoff,
}: {
  contextTokens: number | null | undefined
  contextWindowTokens: number | null | undefined
  harness: 'claude' | 'codex' | undefined
  isCompacting: boolean
  isHandingOff?: boolean
  onCompact?: () => Promise<boolean>
  onHandoff?: () => Promise<boolean>
}) {
  const selectedHarness = harness ?? 'codex'
  const usedTokens = contextTokens ?? 0
  const capacityTokens = contextWindowTokens ?? null
  const percentage =
    capacityTokens === null ? null : Math.round((usedTokens / capacityTokens) * 100)
  const canCompact = onCompact !== undefined
  const canHandoff = onHandoff !== undefined
  const contextAlert = percentage !== null && percentage >= 40

  return (
    <div
      className="@container relative z-0 flex min-h-(--size-session-context-bar) min-w-0 select-none items-center gap-2 rounded-b-xl border bg-card px-3 pt-4 pb-2 shadow-(--shadow-surface) @[56rem]:gap-3 @[56rem]:px-4"
      data-component="SessionContextBar"
    >
      <div className="shrink-0 pl-2 @[56rem]:pl-4">
        <UsagePopover harness={selectedHarness} />
      </div>
      <div className="shrink-0 @[56rem]:hidden">
        <ContextPopover
          compact
          harness={selectedHarness}
          capacityTokens={capacityTokens}
          percentage={percentage}
          usedTokens={usedTokens}
        />
      </div>
      <div className="hidden shrink-0 @[56rem]:block">
        <ContextPopover
          harness={selectedHarness}
          capacityTokens={capacityTokens}
          labelled
          percentage={percentage}
          usedTokens={usedTokens}
        />
      </div>
      <ContextMeter contextAlert={contextAlert} percentage={percentage} />
      <ContextSummary percentage={percentage} usedTokens={usedTokens} />
      <SessionContextActions
        {...{ canCompact, canHandoff, isCompacting, isHandingOff, onCompact, onHandoff }}
      />
    </div>
  )
}
