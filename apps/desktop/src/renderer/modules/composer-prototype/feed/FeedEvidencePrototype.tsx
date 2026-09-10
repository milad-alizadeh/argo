import { Expand, PanelRightClose, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/renderer/components/ui/button'
import { FEED_INSPECTOR_EVIDENCE, type FeedPrototypeEvidence } from './evidence'
import { EvidenceBody, EvidenceKindIcon } from './FeedEvidenceBody'
import { CopyFeedContent } from './FeedPrimitives'

function evidenceLabel(kind: FeedPrototypeEvidence['kind']) {
  switch (kind) {
    case 'code':
    case 'diff':
      return 'File change'
    case 'output':
      return 'Command output'
    case 'document':
      return 'Source'
    case 'diagram':
      return 'Diagram'
    case 'image':
      return 'Image'
  }
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
        <EvidenceKindIcon kind={evidence.kind} />
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

function InspectorSection({
  evidence,
  active,
}: {
  evidence: FeedPrototypeEvidence
  active: boolean
}) {
  return (
    <section data-evidence-id={evidence.id} className="min-h-[45%] border-b border-border/60">
      <header
        className={`sticky top-0 z-10 flex items-center gap-2 border-b px-3 py-2 backdrop-blur ${active ? 'bg-muted text-foreground' : 'bg-card/95 text-muted-foreground'}`}
      >
        <EvidenceKindIcon kind={evidence.kind} />
        <span className="min-w-0 flex-1 truncate text-control font-medium">{evidence.title}</span>
        <span className="text-(length:--text-control)">{evidenceLabel(evidence.kind)}</span>
      </header>
      <div className="space-y-4 p-4">
        <p className="break-words text-control leading-relaxed text-muted-foreground">
          {evidence.detail}
        </p>
        <EvidenceBody evidence={evidence} />
      </div>
    </section>
  )
}

export function FeedEvidencePrototype({
  evidence,
  onClose,
}: {
  evidence: FeedPrototypeEvidence
  onClose: () => void
}) {
  const showsToolSequence = FEED_INSPECTOR_EVIDENCE.some((item) => item.id === evidence.id)
  const items = showsToolSequence ? FEED_INSPECTOR_EVIDENCE : [evidence]
  const [activeId, setActiveId] = useState(evidence.id)
  const [expanded, setExpanded] = useState(false)
  const scrollArea = useRef<HTMLDivElement>(null)
  const activeEvidence = items.find((item) => item.id === activeId) ?? evidence

  useEffect(() => {
    setActiveId(evidence.id)
    const target = scrollArea.current?.querySelector<HTMLElement>(
      `[data-evidence-id="${evidence.id}"]`,
    )
    target?.scrollIntoView({ block: 'start' })
  }, [evidence])

  const selectVisibleEvidence = () => {
    if (!scrollArea.current) return
    let visibleId = items[0]?.id ?? evidence.id
    for (const section of scrollArea.current.querySelectorAll<HTMLElement>('[data-evidence-id]')) {
      if (section.offsetTop <= scrollArea.current.scrollTop + 48)
        visibleId = section.dataset.evidenceId ?? visibleId
    }
    setActiveId(visibleId)
  }

  return (
    <section
      className="flex h-full min-h-0 w-full flex-col bg-card"
      aria-label="Command and file inspector"
      data-component="FeedEvidence"
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <EvidenceKindIcon kind={activeEvidence.kind} />
        <div className="min-w-0 flex-1">
          <p className="text-(length:--text-control) text-muted-foreground">
            Inspector · {evidenceLabel(activeEvidence.kind)}
          </p>
          <h2 className="truncate text-control font-medium">{activeEvidence.title}</h2>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Expand result"
          onClick={() => setExpanded(true)}
        >
          <Expand />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Close result sidebar" onClick={onClose}>
          <PanelRightClose />
        </Button>
      </header>
      <div
        ref={scrollArea}
        onScroll={selectVisibleEvidence}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {items.map((item) => (
          <InspectorSection key={item.id} evidence={item} active={item.id === activeId} />
        ))}
      </div>
      <footer className="flex items-center justify-between border-t px-3 py-2 text-control text-muted-foreground">
        <span>{activeEvidence.status === 'failed' ? 'Failed' : 'Recorded result'}</span>
        <CopyFeedContent text={activeEvidence.source} />
      </footer>
      {expanded ? (
        <ExpandedEvidence evidence={activeEvidence} onClose={() => setExpanded(false)} />
      ) : null}
    </section>
  )
}
