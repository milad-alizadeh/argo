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
  detail?: string
}
type ToolSection = {
  title: string
  rows: ToolRow[]
}

const COMMANDS: ToolRow[] = [
  {
    label: 'Searched ContextBar and AttachmentTray',
    evidence: 'search',
    icon: Search,
    detail: '3 matches',
  },
  { label: 'Ran bun test composer', evidence: 'tests', icon: SquareTerminal, detail: '3 passed' },
]
const CREATED_FILES: ToolRow[] = [
  { label: 'Created AttachmentTray.tsx', evidence: 'createdAttachmentTray', icon: FilePenLine },
  { label: 'Created ContextBar.tsx', evidence: 'createdContextBar', icon: FilePenLine },
]
const EDITED_FILES: ToolRow[] = [
  { label: 'Edited Composer.tsx', evidence: 'diff', icon: FilePenLine, detail: '+2 −1' },
]

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
      {row.detail && <span className="ml-auto shrink-0 text-muted-foreground">{row.detail}</span>}
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
        {sections.map((section) => (
          <div key={section.title}>
            {sections.length > 1 ? (
              <p className="px-2 pt-2 text-(length:--text-control) font-medium text-muted-foreground">
                {section.title}
              </p>
            ) : null}
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
      sections={[
        { title: 'Ran 2 commands', rows: COMMANDS },
        { title: 'Created 2 files', rows: CREATED_FILES },
        { title: 'Edited 1 file', rows: EDITED_FILES },
      ]}
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
        sections={[{ title: 'Activity', rows: mutations }]}
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
