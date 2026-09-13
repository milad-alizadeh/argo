import {
  CircleCheck,
  FilePenLine,
  LoaderCircle,
  Search,
  SquareTerminal,
  TerminalIcon,
  Wrench,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { TaskItem } from '@/components/ai-elements/task'
import { CollapsibleText } from '@/renderer/components/CollapsibleText'
import type { SessionFeedRow } from '../types'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>
type ToolCall = Extract<SessionFeedRow, { shape: 'tool-group' }>['calls'][number]

const TOOL_ICONS: Record<ToolRow['kind'], ComponentType<{ className?: string }>> = {
  command: SquareTerminal,
  read: Search,
  edited: FilePenLine,
  created: FilePenLine,
  tool: Wrench,
}

function StatusIcon({ status }: { status: ToolRow['status'] }) {
  switch (status) {
    case 'failed':
      return null
    case 'running':
      return <StatusMark icon={LoaderCircle} label="In progress" className="animate-spin" />
    case 'succeeded':
      return <StatusMark icon={CircleCheck} label="Succeeded" className="text-muted-foreground" />
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

export function FeedToolLine({
  call,
  activeEvidenceId,
  onOpen,
}: {
  call: ToolCall | ToolRow
  activeEvidenceId: string | null
  onOpen: (row: ToolRow) => void
}) {
  const Icon = TOOL_ICONS[call.kind]
  const failed = call.status === 'failed'
  return (
    <button
      type="button"
      aria-current={activeEvidenceId === call.id ? 'location' : undefined}
      className={`flex w-full items-center gap-2 text-left type-body transition-colors ${failed ? 'text-destructive hover:text-destructive' : 'text-muted-foreground hover:text-foreground'} ${activeEvidenceId === call.id ? 'text-foreground' : ''}`}
      data-feed-evidence-id={call.id}
      onClick={() => onOpen({ ...call, shape: 'tool' })}
    >
      <Icon
        aria-hidden="true"
        className={`!size-(--size-icon-inline) shrink-0 ${failed ? 'text-destructive' : 'text-muted-foreground'}`}
      />
      <span className="min-w-0 flex-1 truncate">{call.label}</span>
      {call.detail === null ? null : (
        <span className={`shrink-0 ${failed ? 'text-destructive' : 'text-muted-foreground'}`}>
          {call.detail}
        </span>
      )}
      {failed ? null : <StatusIcon status={call.status} />}
    </button>
  )
}

export function FeedToolGroup({
  group,
  activeEvidenceId,
  open,
  onOpen,
  onOpenChange,
}: {
  group: Extract<SessionFeedRow, { shape: 'tool-group' }>
  activeEvidenceId: string | null
  open: boolean
  onOpen: (row: ToolRow) => void
  onOpenChange: (open: boolean) => void
}) {
  return (
    <CollapsibleText
      content={group.calls.map((call) => (
        <TaskItem key={call.id}>
          <FeedToolLine activeEvidenceId={activeEvidenceId} call={call} onOpen={onOpen} />
        </TaskItem>
      ))}
      icon={TerminalIcon}
      onOpenChange={onOpenChange}
      open={open}
      title={group.label}
    />
  )
}
