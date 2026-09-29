import { useTranslation } from 'react-i18next'
import { displayedToolLabel } from '@/domains/sessions/api/feed/tool-feed'
import { standsAlone, TOOL_KIND_PRESENTATION } from '@/domains/sessions/api/feed/tool-groups'
import { Icon, type IconName } from '@/platform/renderer/components/icon/icon'
import { TaskItem } from '../../ai-elements/task'
import type { SessionFeedRow } from '../../types'
import { FeedInlineMarkdown } from '../content/feed-inline-markdown'
import { FeedMarkdown } from '../content/feed-markdown'
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

// A call reads as running only inside the live group: an older group's call that never
// reported an end is history once newer work has begun.
export function callRunning(call: ToolCall | ToolRow, live: boolean) {
  return live && call.status === 'running'
}

// The numbers sit right after the label, as if inline; a running spinner keeps the far edge.
// Only the live title shimmers, so a call line never does.
export function FeedToolLine({
  call,
  activeEvidenceId,
  live,
  onOpen,
}: {
  call: ToolCall | ToolRow
  activeEvidenceId: string | null
  live: boolean
  onOpen: (row: ToolRow) => void
}) {
  const { t } = useTranslation('sessions')
  const iconName = toolPresentation(call.kind).icon
  const active = activeEvidenceId === call.id
  const failed = call.status === 'failed'
  const running = callRunning(call, live)
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
        {displayedToolLabel(call, running, t('workState.running'))}
      </span>
      {call.lineCounts === null ? null : <LineCounts {...call.lineCounts} />}
      {failed ? <span className="sr-only">{t('tools.failed')}</span> : null}
      <span className="ml-auto flex shrink-0 items-center">
        {running ? <StatusIcon status={call.status} /> : null}
      </span>
    </button>
  )
}

// A group's only inline call shows its code block directly; any other nests in its own disclosure.
function GroupedCall({
  activeEvidenceId,
  call,
  isSole,
  live,
  onOpen,
  toolGroups,
}: {
  activeEvidenceId: string | null
  call: ToolCall
  isSole: boolean
  live: boolean
  onOpen: (row: ToolRow) => void
  toolGroups: ToolGroupState
}) {
  if (toolPresentation(call.kind).route !== 'inline')
    return (
      <FeedToolLine activeEvidenceId={activeEvidenceId} call={call} live={live} onOpen={onOpen} />
    )
  if (!isSole) return <FeedInlineToolCallItem call={call} live={live} toolGroups={toolGroups} />
  // The group's title is its count, so the agent's own description of the call reads here.
  return (
    <>
      {describesItself(call) && <p className="type-body text-muted-foreground">{call.label}</p>}
      <FeedInlineToolCall call={call} live={live} />
    </>
  )
}

// A command's fallback label is its first line, which the code block below it already shows.
function describesItself(call: ToolCall) {
  return call.label !== `Ran ${(call.text ?? '').split('\n')[0]}`
}

type ToolGroup = Extract<SessionFeedRow, { shape: 'tool-group' }>

function groupThoughtsByCall(group: ToolGroup, titleThoughtId: string | undefined) {
  const thoughtsByCall = new Map<number, NonNullable<ToolGroup['thoughts']>>()
  for (const thought of group.thoughts ?? []) {
    if (thought.id === titleThoughtId) continue
    const callIndex = thought.afterCallIndex ?? group.calls.length - 1
    const associated = thoughtsByCall.get(callIndex) ?? []
    associated.push(thought)
    thoughtsByCall.set(callIndex, associated)
  }
  return thoughtsByCall
}

export function FeedToolGroup({
  group,
  activeEvidenceId,
  onOpen,
  toolGroups,
}: {
  group: ToolGroup
  activeEvidenceId: string | null
  onOpen: (row: ToolRow) => void
  toolGroups: ToolGroupState
}) {
  const { onOpenChange, open } = useToolGroupOpen(toolGroups, group.id)
  const soleCall = group.calls.length === 1 ? group.calls[0] : undefined
  const activity = liveActivity(group)
  const live = activity !== null
  // A thought with no words, blank or a bare `---`, renders empty, so it never titles the group.
  const latestCommentary = group.thoughts?.findLast((thought) => /[\p{L}\p{N}]/u.test(thought.text))
  // A call that stands alone (`groupedRowIndexes`) names its group. Every other settled group
  // reads as its count: a command that has run is history, and its text is one disclosure away,
  // never a stray line in the Feed.
  const titleCall = soleCall !== undefined && standsAlone(soleCall.kind) ? soleCall : undefined
  const settledTitle =
    latestCommentary === undefined ? (
      (titleCall?.label ?? group.label)
    ) : (
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate">
          <FeedInlineMarkdown text={latestCommentary.text.trim()} />
        </span>
        <span className="shrink-0">· {group.label}</span>
      </span>
    )
  // The live title is the activity alone: the count waits for the group to settle.
  const title = live ? <LiveActivityText activity={activity} running shimmer /> : settledTitle
  const thoughtsByCall = groupThoughtsByCall(group, live ? undefined : latestCommentary?.id)
  return (
    <CollapsibleText
      content={() =>
        group.calls.flatMap((call, index) => [
          <TaskItem key={call.id}>
            <GroupedCall
              activeEvidenceId={activeEvidenceId}
              call={call}
              isSole={call.id === soleCall?.id}
              live={live}
              onOpen={onOpen}
              toolGroups={toolGroups}
            />
          </TaskItem>,
          ...(thoughtsByCall.get(index) ?? []).map((thought) => (
            <TaskItem key={thought.id}>
              <div className="break-words text-muted-foreground type-body">
                <FeedMarkdown text={thought.text} />
              </div>
            </TaskItem>
          )),
        ])
      }
      contentVariant="flush"
      icon={groupIcon(activity, titleCall?.kind)}
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    />
  )
}
