import { Info, Layers3 } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '../../../../components/ui/popover'
import { ContextDetails } from './context-details'
import { contextZone } from './context-zone'

type ContextTriggerProps = {
  capacityTokens: number | null
  percentage: number | null
  usedTokens: number
}

function CompactContextTrigger({ capacityTokens, percentage, usedTokens }: ContextTriggerProps) {
  const value =
    capacityTokens === null || percentage === null
      ? `${Math.round(usedTokens / 1000)}k tokens`
      : `${Math.round(usedTokens / 1000)}k / ${Math.round(capacityTokens / 1000)}k · ${percentage}%`
  const zone = contextZone(percentage ?? 0)
  const accessibleName =
    capacityTokens === null || percentage === null
      ? `Context ${Math.round(usedTokens / 1000)}k tokens, total not reported`
      : `Context ${Math.round(usedTokens / 1000)}k tokens of ${Math.round(capacityTokens / 1000)}k tokens, ${percentage}%`
  return (
    <PopoverTrigger
      render={
        <Button
          aria-label={accessibleName}
          className="gap-1.5 px-2 type-label font-medium text-foreground"
          size="sm"
          variant="ghost"
        />
      }
    >
      <svg viewBox="0 0 20 20" className={`-rotate-90 ${zone.text}`} aria-hidden="true">
        <circle
          cx="10"
          cy="10"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="2.5"
        />
        <circle
          cx="10"
          cy="10"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${percentage ?? 0} 100`}
        />
      </svg>
      <span>
        Context{' '}
        <span className="hidden tabular-nums text-muted-foreground @[23rem]:inline">{value}</span>
        <span className="tabular-nums text-muted-foreground @[23rem]:hidden">
          {percentage === null ? '–' : `${percentage}%`}
        </span>
      </span>
    </PopoverTrigger>
  )
}

function LabelledContextTrigger({ percentage }: ContextTriggerProps) {
  const accessibleName =
    percentage === null ? 'Context total not reported' : `Context ${percentage}%`
  return (
    <PopoverTrigger
      render={
        <Button
          aria-label={accessibleName}
          className={`shrink-0 gap-1.5 px-2 type-label font-medium ${percentage !== null && percentage >= 40 ? 'text-red-600' : 'text-foreground'}`}
          size="sm"
          variant="ghost"
        />
      }
    >
      <Layers3 />
      <span>Context</span>
    </PopoverTrigger>
  )
}

function ContextPopoverTrigger({
  compact,
  labelled,
  ...props
}: ContextTriggerProps & { compact: boolean; labelled: boolean }) {
  if (compact) return <CompactContextTrigger {...props} />
  if (labelled) return <LabelledContextTrigger {...props} />
  return (
    <PopoverTrigger render={<Button aria-label="Context details" size="icon-sm" variant="ghost" />}>
      <Info />
    </PopoverTrigger>
  )
}
export function ContextPopover({
  compact = false,
  capacityTokens,
  harness = 'codex',
  labelled = false,
  percentage,
  usedTokens,
}: {
  compact?: boolean
  capacityTokens: number | null
  harness?: 'claude' | 'codex'
  labelled?: boolean
  percentage: number | null
  usedTokens: number
}) {
  return (
    <Popover>
      <ContextPopoverTrigger
        compact={compact}
        capacityTokens={capacityTokens}
        labelled={labelled}
        percentage={percentage}
        usedTokens={usedTokens}
      />
      <PopoverContent align="end" side="top" className="w-(--size-session-popover) gap-3 p-4">
        <PopoverHeader className="gap-1">
          <PopoverTitle>Context window</PopoverTitle>
          <PopoverDescription className="type-prose">
            The working memory for the next response: instructions, tools, files, and conversation.
            As it fills, new information competes with older details.
          </PopoverDescription>
        </PopoverHeader>
        <ContextDetails
          capacityTokens={capacityTokens}
          harness={harness}
          percentage={percentage}
          usedTokens={usedTokens}
        />
      </PopoverContent>
    </Popover>
  )
}
