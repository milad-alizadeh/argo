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

function contextZone(percentage: number) {
  if (percentage <= 20) return { label: 'Smart Zone', text: 'text-emerald-600' }
  if (percentage <= 40) return { label: 'Nearing Dumb Zone', text: 'text-amber-600' }
  return { label: 'Dumb Zone', text: 'text-red-600' }
}

function ContextPopoverTrigger({
  compact,
  labelled,
  percentage,
  usedTokens,
}: {
  compact: boolean
  labelled: boolean
  percentage: number
  usedTokens: number
}) {
  const value = `${Math.round(usedTokens / 1000)}k / 200k · ${percentage}%`
  const zone = contextZone(percentage)
  let accessibleName = 'Context details'
  let button = <Button aria-label={accessibleName} size="icon-sm" variant="ghost" />
  let content = <Info />
  if (compact) {
    accessibleName = `Context ${Math.round(usedTokens / 1000)}k tokens of 200k tokens, ${percentage}%`
    button = (
      <Button
        aria-label={accessibleName}
        className="gap-1.5 px-2 type-label font-medium text-foreground"
        size="sm"
        variant="ghost"
      />
    )
    content = (
      <>
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
            strokeDasharray={`${percentage} 100`}
          />
        </svg>
        <span>
          Context{' '}
          <span className="hidden tabular-nums text-muted-foreground @[23rem]:inline">{value}</span>
          <span className="tabular-nums text-muted-foreground @[23rem]:hidden">{percentage}%</span>
        </span>
      </>
    )
  } else if (labelled) {
    accessibleName = `Context ${percentage}%`
    button = (
      <Button
        aria-label={accessibleName}
        className={`shrink-0 gap-1.5 px-2 type-label font-medium ${percentage >= 40 ? 'text-red-600' : 'text-foreground'}`}
        size="sm"
        variant="ghost"
      />
    )
    content = (
      <>
        <Layers3 />
        <span>Context</span>
      </>
    )
  }
  return <PopoverTrigger render={button}>{content}</PopoverTrigger>
}
export function ContextPopover({
  compact = false,
  harness = 'codex',
  labelled = false,
  percentage,
  usedTokens,
}: {
  compact?: boolean
  harness?: 'claude' | 'codex'
  labelled?: boolean
  percentage: number
  usedTokens: number
}) {
  return (
    <Popover>
      <ContextPopoverTrigger
        compact={compact}
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
        <ContextDetails harness={harness} percentage={percentage} usedTokens={usedTokens} />
      </PopoverContent>
    </Popover>
  )
}
