import { useEffect, useRef, useState } from 'react'
import { FEED_INSPECTOR_EVIDENCE, type FeedPrototypeEvidence } from './evidence'
import { EvidenceBody } from './FeedEvidenceBody'
import { CopyFeedContent } from './FeedPrimitives'

function InspectorSection({ evidence }: { evidence: FeedPrototypeEvidence }) {
  return (
    <section data-evidence-id={evidence.id} className="min-h-[45%] border-b border-border/60">
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
  onActiveEvidenceChange,
}: {
  evidence: FeedPrototypeEvidence
  onActiveEvidenceChange: (evidenceId: string) => void
}) {
  const showsToolSequence = FEED_INSPECTOR_EVIDENCE.some((item) => item.id === evidence.id)
  const items = showsToolSequence ? FEED_INSPECTOR_EVIDENCE : [evidence]
  const [activeId, setActiveId] = useState(evidence.id)
  const scrollArea = useRef<HTMLDivElement>(null)
  const activeEvidence = items.find((item) => item.id === activeId) ?? evidence

  useEffect(() => {
    setActiveId(evidence.id)
    onActiveEvidenceChange(evidence.id)
    const target = scrollArea.current?.querySelector<HTMLElement>(
      `[data-evidence-id="${evidence.id}"]`,
    )
    if (scrollArea.current && target) scrollArea.current.scrollTop = target.offsetTop
  }, [evidence, onActiveEvidenceChange])

  const selectVisibleEvidence = () => {
    if (!scrollArea.current) return
    let visibleId = items[0]?.id ?? evidence.id
    for (const section of scrollArea.current.querySelectorAll<HTMLElement>('[data-evidence-id]')) {
      if (section.offsetTop <= scrollArea.current.scrollTop + 48)
        visibleId = section.dataset.evidenceId ?? visibleId
    }
    if (visibleId !== activeId) {
      setActiveId(visibleId)
      onActiveEvidenceChange(visibleId)
    }
  }

  return (
    <section
      className="flex h-full min-h-0 w-full flex-col bg-card"
      aria-label="Command and file inspector"
      data-component="FeedEvidence"
    >
      <div
        ref={scrollArea}
        onScroll={selectVisibleEvidence}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {items.map((item) => (
          <InspectorSection key={item.id} evidence={item} />
        ))}
        {showsToolSequence && <div aria-hidden="true" className="h-[calc(100%-3rem)]" />}
      </div>
      <footer className="flex items-center justify-between border-t px-3 py-2 text-control text-muted-foreground">
        <span>{activeEvidence.status === 'failed' ? 'Failed' : 'Recorded result'}</span>
        <CopyFeedContent text={activeEvidence.source} />
      </footer>
    </section>
  )
}
