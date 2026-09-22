import { useTranslation } from 'react-i18next'
import {
  displayedToolLabel,
  standsAlone,
  TOOL_KIND_PRESENTATION,
} from '@/domains/sessions/contract/model'
import { Icon, type IconName } from '@/platform/renderer/components/icon/icon'
import { RunningText } from '@/platform/renderer/components/running-text'
import { TaskItem } from '../../ai-elements'
import type { SessionFeedRow } from '../../types'
import { LiveActivityText } from '../rows/live-activity-text'
import { type ToolGroupState, useToolGroupOpen } from '../rows/tool-group-state'
import { CollapsibleText } from './collapsible-text'
import { groupIcon, liveActivity } from './feed-group-title'
import { FeedInlineToolCall, FeedInlineToolCallItem } from './feed-inline-tool-call'
import { StatusIcon } from './feed-tool-status'

export type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>
export type ToolCall = Extract<SessionFeedRow, { shape: 'tool-group' }>['calls'][number]

const TOOL_ICONS = {
  terminal: 'tool-terminal',
  search: 'search',
  file: 'tool-edit-file',
  wrench: 'tool-generic',
  wand: 'tool-magic',
  globe: 'tool-web',
} satisfies Record<(typeof TOOL_KIND_PRESENTATION)[ToolRow['kind']]['icon'], IconName>

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
  const iconName = toolPresentation(call.kind).icon
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
      <Icon className="!size-(--size-icon-inline) shrink-0" name={iconName} />
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
  if (!isSole) return <FeedInlineToolCallItem call={call} toolGroups={toolGroups} />
  // The group's title is its count, so the agent's own description of the call reads here.
  return (
    <>
      {describesItself(call) && <p className="type-body text-muted-foreground">{call.label}</p>}
      <FeedInlineToolCall call={call} />
    </>
  )
}

// A command's fallback label is its first line, which the code block below it already shows.
function describesItself(call: ToolCall) {
  return call.label !== `Ran ${(call.text ?? '').split('\n')[0]}`
}

export function FeedToolGroup({
  group,
  activeEvidenceId,
  onOpen,
  toolGroups,
}: {
  group: Extract<SessionFeedRow, { shape: 'tool-group' }>
  activeEvidenceId: string | null
  onOpen: (row: ToolRow) => void
  toolGroups: ToolGroupState
}) {
  const { onOpenChange, open } = useToolGroupOpen(toolGroups, group.id)
  const soleCall = group.calls.length === 1 ? group.calls[0] : undefined
  const activity = liveActivity(group)
  // A call that stands alone (`groupedRowIndexes`) names its group. Every other settled group
  // reads as its count: a command that has run is history, and its text is one disclosure away,
  // never a stray line in the Feed.
  const titleCall = soleCall !== undefined && standsAlone(soleCall.kind) ? soleCall : undefined
  const title =
    activity === null ? (
      (titleCall?.label ?? group.label)
    ) : (
      <LiveActivityText activity={activity} running shimmer />
    )
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
      icon={groupIcon(activity, titleCall?.kind)}
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    />
  )
}
