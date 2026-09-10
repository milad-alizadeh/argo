import {
  BookOpen,
  Check,
  ChevronRight,
  Circle,
  FilePenLine,
  Globe,
  PanelRightOpen,
  Search,
  SquareTerminal,
  Wrench,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Button } from '@/renderer/components/ui/button'
import { FEED_EVIDENCE, type FeedEvidenceAction, type FeedPrototypeEvidence } from './evidence'

type ToolRow = {
  label: string
  evidence: keyof typeof FEED_EVIDENCE
  icon: ComponentType<{ className?: string }>
  detail?: string
}
const READS: ToolRow[] = [
  {
    label: 'Searched ContextBar and AttachmentTray',
    evidence: 'search',
    icon: Search,
    detail: '3 matches',
  },
  { label: 'Read Composer.tsx', evidence: 'source', icon: BookOpen },
  { label: 'Fetched the migration contract', evidence: 'fetched', icon: Globe },
]
const WORK: ToolRow[] = [
  { label: 'Edited Composer.tsx', evidence: 'diff', icon: FilePenLine, detail: '+2 −1' },
  { label: 'Ran bun test composer', evidence: 'tests', icon: SquareTerminal, detail: '3 passed' },
  { label: 'Called github.get_issue', evidence: 'mcp', icon: Wrench },
]

export function FeedToolLine({ row, onOpen }: { row: ToolRow; onOpen: FeedEvidenceAction }) {
  const evidence = FEED_EVIDENCE[row.evidence]
  return (
    <Button
      variant="ghost"
      onClick={() => onOpen(evidence)}
      className="h-auto w-full justify-start gap-2 px-2 py-2 text-control font-normal"
    >
      <row.icon className="!size-(--size-icon-inline) text-muted-foreground" />
      <span className="min-w-0 truncate">{row.label}</span>
      {row.detail && <span className="ml-auto shrink-0 text-muted-foreground">{row.detail}</span>}
      <PanelRightOpen className="ml-auto !size-(--size-icon-inline) shrink-0 text-muted-foreground" />
    </Button>
  )
}

function ToolGroup({
  title,
  rows,
  onOpen,
}: {
  title: string
  rows: ToolRow[]
  onOpen: FeedEvidenceAction
}) {
  return (
    <details className="group rounded-lg border bg-card open:pb-1">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-control">
        <ChevronRight className="!size-(--size-icon-inline) text-muted-foreground group-open:rotate-90" />
        <span className="font-medium">{title}</span>
        <span className="ml-auto text-muted-foreground">{rows.length} tool calls</span>
      </summary>
      <div className="mx-2 border-t pt-1">
        {rows.map((row) => (
          <FeedToolLine key={row.label} row={row} onOpen={onOpen} />
        ))}
      </div>
    </details>
  )
}

export function FeedToolGroups({ onOpen }: { onOpen: FeedEvidenceAction }) {
  return (
    <div className="space-y-2" data-component="FeedToolGroups">
      <ToolGroup title="Searched, read and checked the contract" rows={READS} onOpen={onOpen} />
      <ToolGroup title="Updated the composer and ran checks" rows={WORK} onOpen={onOpen} />
    </div>
  )
}

export function FeedPendingCall() {
  return (
    <div className="flex items-center gap-2 py-2 text-control" role="status">
      <Circle className="!size-(--size-icon-inline) motion-safe:animate-pulse" />
      <span>Running the attachment stress check</span>
      <span className="ml-auto text-muted-foreground">12s</span>
    </div>
  )
}

export function FeedMutationExamples({ onOpen }: { onOpen: FeedEvidenceAction }) {
  const mutations = [
    'Created AttachmentTray.tsx',
    'Moved queue.ts to the Session module',
    'Deleted the unused draft helper',
  ]
  return (
    <div className="space-y-1">
      {mutations.map((label) => (
        <FeedToolLine
          key={label}
          row={{ label, evidence: 'diff', icon: FilePenLine }}
          onOpen={(evidence) =>
            onOpen({
              ...evidence,
              title: label,
              source: 'The recorded call completed successfully.',
              kind: 'output',
            })
          }
        />
      ))}
      <FeedToolLine
        row={{ label: 'Called an unclassified tool', evidence: 'mcp', icon: Wrench }}
        onOpen={onOpen}
      />
      <div className="flex items-center gap-2 px-2 py-2 text-control text-muted-foreground">
        <Check className="!size-(--size-icon-inline)" />
        Returned from layout review<span className="ml-auto">38s</span>
      </div>
    </div>
  )
}

export function FeedEvidenceLink({
  evidence,
  onOpen,
  children,
}: {
  evidence: FeedPrototypeEvidence
  onOpen: FeedEvidenceAction
  children: string
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 underline decoration-border underline-offset-4 hover:decoration-foreground"
      onClick={() => onOpen(evidence)}
    >
      {children}
      <PanelRightOpen className="!size-(--size-icon-inline)" />
    </button>
  )
}
