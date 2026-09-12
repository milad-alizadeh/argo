import { Check, FilePenLine, Search, SquareTerminal, TerminalIcon, Wrench } from 'lucide-react'
import type { ComponentType } from 'react'
import { TaskItem } from '@/components/ai-elements/task'
import { CollapsibleText } from '@/renderer/components/CollapsibleText'
import { FEED_EVIDENCE, type FeedEvidenceAction } from './evidence'

type ToolRow = {
  label: string
  evidence: keyof typeof FEED_EVIDENCE
  icon: ComponentType<{ className?: string }>
  detail?: ToolRowDetail
}
type ToolRowDetail =
  | { kind: 'text'; value: string }
  | { added: string; kind: 'diff'; removed: string }
type ToolSection = {
  rows: ToolRow[]
}

const COMMANDS: ToolRow[] = [
  {
    label: 'Searched ContextBar and AttachmentTray',
    evidence: 'search',
    icon: Search,
    detail: { kind: 'text', value: '3 matches' },
  },
  {
    label: 'Ran bun test composer',
    evidence: 'tests',
    icon: SquareTerminal,
    detail: { kind: 'text', value: '3 passed' },
  },
]
const CREATED_FILES: ToolRow[] = [
  { label: 'Created AttachmentTray.tsx', evidence: 'createdAttachmentTray', icon: FilePenLine },
  { label: 'Created ContextBar.tsx', evidence: 'createdContextBar', icon: FilePenLine },
]
const EDITED_FILES: ToolRow[] = [
  {
    label: 'Edited Composer.tsx',
    evidence: 'diff',
    icon: FilePenLine,
    detail: { added: '+2', kind: 'diff', removed: '−1' },
  },
]

function ToolRowDetail({ detail }: { detail: ToolRowDetail }) {
  switch (detail.kind) {
    case 'text':
      return <span className="shrink-0 type-meta text-muted-foreground">{detail.value}</span>
    case 'diff':
      return (
        <span className="flex shrink-0 items-center gap-1 type-meta">
          <span className="text-emerald-600 dark:text-emerald-400">{detail.added}</span>
          <span className="text-destructive">{detail.removed}</span>
        </span>
      )
  }
}

export function FeedToolLine({
  row,
  onOpen,
  activeEvidenceId,
}: {
  row: ToolRow
  onOpen: FeedEvidenceAction
  activeEvidenceId: string | null
}) {
  const evidence = FEED_EVIDENCE[row.evidence]
  const active = activeEvidenceId === evidence.id
  return (
    <button
      type="button"
      onClick={() => onOpen(evidence)}
      aria-current={active ? 'location' : undefined}
      data-feed-evidence-id={evidence.id}
      className={`flex w-full items-center gap-2 text-left text-muted-foreground transition-colors hover:text-foreground ${active ? 'text-foreground' : ''}`}
    >
      <row.icon className="!size-(--size-icon-inline) shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate type-body">{row.label}</span>
      {row.detail && <ToolRowDetail detail={row.detail} />}
    </button>
  )
}

function ToolGroup({
  title,
  sections,
  onOpen,
  activeEvidenceId,
}: {
  title: string
  sections: ToolSection[]
  onOpen: FeedEvidenceAction
  activeEvidenceId: string | null
}) {
  return (
    <CollapsibleText
      icon={TerminalIcon}
      title={title}
      content={sections.flatMap((section) =>
        section.rows.map((row) => (
          <TaskItem key={row.label}>
            <FeedToolLine row={row} onOpen={onOpen} activeEvidenceId={activeEvidenceId} />
          </TaskItem>
        )),
      )}
    />
  )
}

export function FeedToolGroups({
  onOpen,
  activeEvidenceId,
}: {
  onOpen: FeedEvidenceAction
  activeEvidenceId: string | null
}) {
  return (
    <ToolGroup
      title="Ran 2 commands · Created 2 files · Edited 1 file"
      sections={[{ rows: COMMANDS }, { rows: CREATED_FILES }, { rows: EDITED_FILES }]}
      onOpen={onOpen}
      activeEvidenceId={activeEvidenceId}
    />
  )
}

export function FeedMutationExamples({
  onOpen,
  activeEvidenceId,
}: {
  onOpen: FeedEvidenceAction
  activeEvidenceId: string | null
}) {
  const mutations: ToolRow[] = [
    {
      label: 'Created AttachmentTray.tsx',
      evidence: 'createdAttachmentTray',
      icon: FilePenLine,
    },
    { label: 'Moved queue.ts to the Session module', evidence: 'movedQueue', icon: FilePenLine },
    { label: 'Deleted the unused draft helper', evidence: 'deletedDraft', icon: FilePenLine },
    { label: 'Called an unclassified tool', evidence: 'unclassified', icon: Wrench },
    { label: 'Ran bun run preview', evidence: 'failed', icon: SquareTerminal },
  ]
  return (
    <div className="space-y-2">
      <ToolGroup
        title="Ran 2 commands · Changed 3 files"
        sections={[{ rows: mutations }]}
        onOpen={onOpen}
        activeEvidenceId={activeEvidenceId}
      />
      <div className="flex items-center gap-2 px-2 py-2 type-meta text-muted-foreground">
        <Check className="!size-(--size-icon-inline)" />
        Returned from layout review<span className="ml-auto">38s</span>
      </div>
    </div>
  )
}
