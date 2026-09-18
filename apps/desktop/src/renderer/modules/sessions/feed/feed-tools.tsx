import { FilePenLine, Search, SquareTerminal, WandSparkles, Wrench } from 'lucide-react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { displayedToolLabel } from '@/core/sessions/tool-feed'
import { TOOL_KIND_PRESENTATION } from '@/core/sessions/tool-groups'
import { TaskItem } from '@/platform/renderer/components/ai-elements/task'
import { CollapsibleText } from '@/platform/renderer/components/collapsible-text'
import type { SessionFeedRow } from '../types'
import { FeedInlineToolCall, FeedInlineToolCallItem } from './feed-inline-tool-call'
import { RunningText, StatusIcon } from './feed-tool-status'
import { type ToolGroupState, useToolGroupOpen } from './tool-group-state'

export type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>
export type ToolCall = Extract<SessionFeedRow, { shape: 'tool-group' }>['calls'][number]

const TOOL_ICONS = {
  terminal: SquareTerminal,
  search: Search,
  file: FilePenLine,
  wrench: Wrench,
  wand: WandSparkles,
} satisfies Record<
  (typeof TOOL_KIND_PRESENTATION)[ToolRow['kind']]['icon'],
  ComponentType<{ className?: string }>
>

export function toolPresentation(kind: ToolRow['kind']) {
  const presentation = TOOL_KIND_PRESENTATION[kind]
  return { ...presentation, icon: TOOL_ICONS[presentation.icon] }
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
  const Icon = toolPresentation(call.kind).icon
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
        <RunningText running={call.status === 'running'}>
          {displayedToolLabel(call, call.status === 'running', t('workState.running'))}
        </RunningText>
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
  if (toolPresentation(call.kind).route !== 'inline')
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
  const { t } = useTranslation('sessions')
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
  const title =
    titleCall === undefined
      ? group.label
      : displayedToolLabel(titleCall, latestCall !== undefined, t('workState.running'))
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
      icon={titleCall === undefined ? SquareTerminal : toolPresentation(titleCall.kind).icon}
      onOpenChange={onOpenChange}
      open={open}
      title={<RunningText running={latestCall !== undefined}>{title}</RunningText>}
    />
  )
}
