import {
  Check,
  ChevronRight,
  FilePenLine,
  LoaderCircle,
  PanelRightOpen,
  Search,
  SquareTerminal,
  Wrench,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Button } from '@/renderer/components/ui/button'
import { Marker, MarkerContent, MarkerIcon } from '@/renderer/components/ui/marker'
import { FEED_EVIDENCE, type FeedEvidenceAction, type FeedPrototypeEvidence } from './evidence'

export const FEED_DISCLOSURE_SURFACE_CLASS = 'bg-card transition-colors hover:bg-muted'

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
      return <span className="shrink-0 text-muted-foreground">{detail.value}</span>
    case 'diff':
      return (
        <span className="flex shrink-0 items-center gap-1">
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
    <Button
      variant="ghost"
      onClick={() => onOpen(evidence)}
      aria-current={active ? 'location' : undefined}
      data-feed-evidence-id={evidence.id}
      className={`h-auto w-full justify-start gap-2 px-2 py-2 text-(length:--text-control) font-normal ${active ? 'bg-muted text-foreground' : ''}`}
    >
      <row.icon className="!size-(--size-icon-inline) text-muted-foreground" />
      <span className="min-w-0 truncate">{row.label}</span>
      {row.detail && <ToolRowDetail detail={row.detail} />}
      <PanelRightOpen className="ml-auto !size-(--size-icon-inline) shrink-0 text-muted-foreground" />
    </Button>
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
    <details className="group rounded-lg border open:pb-1">
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2.5 text-control ${FEED_DISCLOSURE_SURFACE_CLASS}`}
      >
        <span className="min-w-0 text-(length:--text-body) font-medium">{title}</span>
        <ChevronRight className="!size-(--size-icon-inline) shrink-0 text-muted-foreground group-open:rotate-90" />
      </summary>
      <div className="mx-2 space-y-1 border-t pt-1">
        {sections.map((section, index) => (
          <div key={section.rows[0]?.label ?? index}>
            {section.rows.map((row) => (
              <FeedToolLine
                key={row.label}
                row={row}
                onOpen={onOpen}
                activeEvidenceId={activeEvidenceId}
              />
            ))}
          </div>
        ))}
      </div>
    </details>
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

export function FeedPendingCall({ mode = 'running' }: { mode?: 'running' | 'thinking' }) {
  return (
    <Marker className="py-2 text-(length:--text-body)" role="status">
      <MarkerIcon>
        <LoaderCircle className="!size-(--size-icon-control) motion-safe:animate-spin" />
      </MarkerIcon>
      <MarkerContent>
        <span className="font-medium">{mode === 'thinking' ? 'Thinking' : 'Running'}</span>
        <span className="ml-1 text-foreground">the attachment stress check</span>
      </MarkerContent>
      <span className="ml-auto text-(length:--text-control) text-muted-foreground">12s</span>
    </Marker>
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
