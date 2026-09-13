import { PanelRightOpen } from 'lucide-react'
import type { ReactNode } from 'react'
import type { FeedEvidenceAction, FeedPrototypeEvidence } from './evidence'

export function FeedEvidenceLink({
  evidence,
  onOpen,
  children,
}: {
  evidence: FeedPrototypeEvidence
  onOpen: FeedEvidenceAction
  children: ReactNode
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
