import {
  FilePenLine,
  LoaderCircle,
  Search,
  SquareTerminal,
  WandSparkles,
  Wrench,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { TaskItem } from '@/components/ai-elements/task'
import { TOOL_CONTENT_ROUTE } from '@/core/sessions/tool-groups'
import { CollapsibleText } from '@/renderer/components/collapsible-text'
import type { SessionFeedRow } from '../types'
import { FeedInlineToolCall, FeedInlineToolCallItem } from './feed-inline-tool-call'
import { type ToolGroupState, useToolGroupOpen } from './tool-group-state'

export type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>
export type ToolCall = Extract<SessionFeedRow, { shape: 'tool-group' }>['calls'][number]

export const TOOL_ICONS: Record<ToolRow['kind'], ComponentType<{ className?: string }>> = {
  command: SquareTerminal,
  read: Search,
  edited: FilePenLine,
  created: FilePenLine,
  tool: Wrench,
  skill: WandSparkles,
}

export function StatusIcon({ status }: { status: ToolRow['status'] }) {
  switch (status) {
    case 'failed':
    case 'succeeded':
      return null
    case 'running':
      return <StatusMark icon={LoaderCircle} label="In progress" className="animate-spin" />
  }
}

function StatusMark({
  icon: Icon,
  label,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  className: string
}) {
  return (
    <>
      <Icon aria-hidden="true" className={`size-4 shrink-0 ${className}`} />
      <span className="sr-only">{label}</span>
    </>
  )
}

// Text for work still running carries the Feed's work shimmer.
export function RunningText({ running, children }: { running: boolean; children: string }) {
  return running ? <span className="feed-work-shimmer">{children}</span> : children
}

// A failed call reads red; otherwise the row is muted until hovered or open in the inspector.
function lineInk(failed: boolean, active: boolean) {
  if (failed) return 'text-destructive'
  return active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
}

// The numbers keep their own colours whatever the row's ink.
function LineCounts({ added, removed }: NonNullable<ToolCall['lineCounts']>) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <span className="text-diff-added">{`+${added}`}</span>
      <span className="text-destructive">{`−${removed}`}</span>
    </span>
  )
}

// The numbers sit right after the label, as if inline; a running spinner keeps the far edge.
export function FeedToolLine({
  call,
  activeEvidenceId,
  onOpen,
}: {
  call: ToolCall | ToolRow
  activeEvidenceId: string | null
  onOpen: (row: ToolRow) => void
}) {
  const { t } = useTranslation('sessions')
  const Icon = TOOL_ICONS[call.kind]
  const active = activeEvidenceId === call.id
  const failed = call.status === 'failed'
  return (
    <button
      type="button"
      aria-current={active ? 'location' : undefined}
      className={`flex w-full items-center gap-2 py-1 text-left type-body transition-colors ${lineInk(failed, active)}`}
      data-feed-evidence-id={call.id}
      onClick={() => onOpen({ ...call, shape: 'tool' })}
    >
      <Icon aria-hidden="true" className="!size-(--size-icon-inline) shrink-0" />
      <span className="min-w-0 truncate text-left [direction:rtl]">
        <RunningText running={call.status === 'running'}>{call.label}</RunningText>
      </span>
      {call.lineCounts === null ? null : <LineCounts {...call.lineCounts} />}
      {failed ? <span className="sr-only">{t('tools.failed')}</span> : null}
      <span className="ml-auto flex shrink-0 items-center">
        <StatusIcon status={call.status} />
      </span>
    </button>
  )
}

// A group's only inline call shows its code block directly; any other nests in its own disclosure.
function GroupedCall({
  activeEvidenceId,
  call,
  isSole,
  onOpen,
  toolGroups,
}: {
  activeEvidenceId: string | null
  call: ToolCall
  isSole: boolean
  onOpen: (row: ToolRow) => void
  toolGroups: ToolGroupState
}) {
  if (TOOL_CONTENT_ROUTE[call.kind] !== 'inline')
    return <FeedToolLine activeEvidenceId={activeEvidenceId} call={call} onOpen={onOpen} />
  if (isSole) return <FeedInlineToolCall call={call} />
  return <FeedInlineToolCallItem call={call} toolGroups={toolGroups} />
}

export function FeedToolGroup({
  group,
  live = false,
  activeEvidenceId,
  onOpen,
  toolGroups,
}: {
  group: Extract<SessionFeedRow, { shape: 'tool-group' }>
  live?: boolean
  activeEvidenceId: string | null
  onOpen: (row: ToolRow) => void
  toolGroups: ToolGroupState
}) {
  const { onOpenChange, open } = useToolGroupOpen(toolGroups, group.id)
  const soleCall = group.calls.length === 1 ? group.calls[0] : undefined
  // A skill call never merges with another kind (`groupedRowIndexes`), so its group takes its
  // name. A lone command reads the same way: its own label (an agent-supplied description, or
  // the command itself) is more useful than the generic "Ran a command" summary.
  const namesItsOwnGroup = soleCall?.kind === 'skill' || soleCall?.kind === 'command'
  // While the group is still growing or a call in it runs, it names its latest call, not its summary.
  const latestCall = live
    ? group.calls.at(-1)
    : group.calls.findLast((call) => call.status === 'running')
  const titleCall = latestCall ?? (namesItsOwnGroup ? soleCall : undefined)
  return (
    <CollapsibleText
      content={group.calls.map((call) => (
        <TaskItem key={call.id}>
          <GroupedCall
            activeEvidenceId={activeEvidenceId}
            call={call}
            isSole={call.id === soleCall?.id}
            onOpen={onOpen}
            toolGroups={toolGroups}
          />
        </TaskItem>
      ))}
      contentVariant="flush"
      icon={titleCall === undefined ? SquareTerminal : TOOL_ICONS[titleCall.kind]}
      onOpenChange={onOpenChange}
      open={open}
      title={
        <RunningText running={latestCall !== undefined}>
          {titleCall?.label ?? group.label}
        </RunningText>
      }
    />
  )
}
