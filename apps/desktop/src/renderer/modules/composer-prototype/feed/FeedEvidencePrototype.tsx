import { Expand, FileCode, PanelRightClose, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/renderer/components/ui/button'
import type { FeedPrototypeEvidence } from './evidence'
import { DiagramDrawing } from './FeedDiagram'
import { CopyFeedContent } from './FeedPrimitives'

function EvidenceBody({ evidence }: { evidence: FeedPrototypeEvidence }) {
  switch (evidence.kind) {
    case 'image':
      return (
        <img
          src={evidence.source}
          alt="Two people reviewing work on a laptop"
          width={320}
          height={213}
          className="h-auto w-full rounded-md object-contain"
        />
      )
    case 'diagram':
      return (
        <div className="overflow-auto rounded-lg border bg-background">
          <DiagramDrawing />
        </div>
      )
    case 'diff':
      return (
        <pre className="overflow-x-auto font-mono text-control leading-relaxed">
          {evidence.source.split('\n').map((line) => (
            <DiffLine key={line} line={line} />
          ))}
        </pre>
      )
    case 'document':
      return <div className="whitespace-pre-wrap text-body leading-relaxed">{evidence.source}</div>
    case 'code':
    case 'output':
      return (
        <pre className="overflow-x-auto font-mono text-control leading-relaxed">
          <code>{evidence.source}</code>
        </pre>
      )
  }
}

function DiffLine({ line }: { line: string }) {
  let tone = 'text-foreground'
  if (line.startsWith('+')) tone = 'bg-muted font-medium text-foreground'
  if (line.startsWith('-')) tone = 'bg-destructive/10 text-destructive'
  return <span className={`block min-w-fit ${tone}`}>{line || ' '}</span>
}

function ExpandedEvidence({
  evidence,
  onClose,
}: {
  evidence: FeedPrototypeEvidence
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      className="fixed inset-4 m-auto max-h-full w-full max-w-4xl overflow-hidden rounded-xl border bg-popover p-0 text-popover-foreground shadow-xl backdrop:bg-background/80"
      aria-label={evidence.title}
    >
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h2 className="min-w-0 flex-1 truncate text-body font-medium">{evidence.title}</h2>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Close expanded view"
          onClick={() => dialog.current?.close()}
        >
          <X className="!size-(--size-icon-control)" />
        </Button>
      </div>
      <div className="max-h-160 overflow-auto p-6">
        <EvidenceBody evidence={evidence} />
      </div>
      <p className="border-t px-4 py-3 text-control text-muted-foreground">{evidence.detail}</p>
    </dialog>
  )
}

export function FeedEvidencePrototype({
  evidence,
  onClose,
}: {
  evidence: FeedPrototypeEvidence
  onClose: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <section
      className="flex h-full min-h-0 flex-col bg-card"
      aria-label="Tool result"
      data-component="FeedEvidence"
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <FileCode className="!size-(--size-icon-control) shrink-0 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 truncate text-body font-medium">{evidence.title}</h2>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Expand result"
          onClick={() => setExpanded(true)}
        >
          <Expand className="!size-(--size-icon-control)" />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Close result sidebar" onClick={onClose}>
          <PanelRightClose className="!size-(--size-icon-control)" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        <p className="break-words text-control leading-relaxed text-muted-foreground">
          {evidence.detail}
        </p>
        <EvidenceBody evidence={evidence} />
      </div>
      <footer className="flex items-center justify-between border-t px-3 py-2 text-control text-muted-foreground">
        <span>{evidence.status === 'failed' ? 'Failed' : 'Recorded result'}</span>
        <CopyFeedContent text={evidence.source} />
      </footer>
      {expanded && <ExpandedEvidence evidence={evidence} onClose={() => setExpanded(false)} />}
    </section>
  )
}
