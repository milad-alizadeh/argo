import { useLayoutEffect, useRef } from 'react'
import { FEED_INSPECTOR_EVIDENCE, type FeedPrototypeEvidence } from './evidence'
import { EvidenceBody } from './FeedEvidenceBody'

function InspectorSection({ evidence }: { evidence: FeedPrototypeEvidence }) {
  return (
    <section data-evidence-id={evidence.id} className="min-h-[45%] border-b border-border/60">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-surface-panel px-4 py-3">
        <p className="break-words type-meta text-muted-foreground">{evidence.detail}</p>
      </header>
      <div className="p-4">
        <EvidenceBody evidence={evidence} />
      </div>
    </section>
  )
}

export function FeedEvidencePrototype({ evidence }: { evidence: FeedPrototypeEvidence }) {
  const showsToolSequence = FEED_INSPECTOR_EVIDENCE.some((item) => item.id === evidence.id)
  const items = showsToolSequence ? FEED_INSPECTOR_EVIDENCE : [evidence]
  const scrollArea = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const area = scrollArea.current
    const target = area?.querySelector<HTMLElement>(`[data-evidence-id="${evidence.id}"]`)
    if (!area || !target) return
    const frame = window.requestAnimationFrame(() => {
      area.scrollTop = target.offsetTop
    })
    return () => window.cancelAnimationFrame(frame)
  }, [evidence])

  return (
    <section
      className="flex h-full min-h-0 w-full flex-col bg-surface-panel"
      aria-label="Command and file inspector"
      data-component="FeedEvidence"
    >
      <div
        ref={scrollArea}
        className="relative min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]"
      >
        {items.map((item) => (
          <InspectorSection key={item.id} evidence={item} />
        ))}
        {showsToolSequence && <div aria-hidden="true" className="h-[calc(100%-3rem)]" />}
      </div>
    </section>
  )
}
