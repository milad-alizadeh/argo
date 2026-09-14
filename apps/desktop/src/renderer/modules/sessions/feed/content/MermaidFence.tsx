import { createContext, useContext } from 'react'
import type { ExtraProps } from 'react-markdown'
import type { SessionDiagramEvidence } from '../../types'
import { FeedMermaid } from './FeedMermaid'

type MarkdownNode = ExtraProps['node']

export type DiagramEvidenceContextValue = {
  rowId: string
  activeEvidenceId: string | null
  onOpenEvidence: (evidence: SessionDiagramEvidence) => void
}

// Set only when the caller wired evidence handling (an assistant's Feed row); a Ticket's
// description renders the same diagram with no way to open it.
export const DiagramEvidence = createContext<DiagramEvidenceContextValue | null>(null)

// A mermaid fence's position in its row gives it a stable id across renders, so the reader's
// selection survives a re-render without Argo inventing a counter to track fences by hand.
export function MermaidFence({ node, source }: { node: MarkdownNode; source: string }) {
  const context = useContext(DiagramEvidence)
  if (context === null) return <FeedMermaid source={source} />
  const id = `${context.rowId}:diagram:${node?.position?.start.offset ?? 0}`
  return (
    <FeedMermaid
      source={source}
      active={context.activeEvidenceId === id}
      onOpen={() => context.onOpenEvidence({ shape: 'diagram', id, title: 'Diagram', source })}
    />
  )
}
