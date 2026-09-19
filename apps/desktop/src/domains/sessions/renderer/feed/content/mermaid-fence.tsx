import { useContext } from 'react'
import type { ExtraProps } from 'react-markdown'
import { FeedMermaid } from '@/domains/sessions/renderer/feed/content/feed-mermaid'
import { MarkdownEvidence } from '@/domains/sessions/renderer/feed/content/markdown-evidence'

type MarkdownNode = ExtraProps['node']

// A mermaid fence's position in its row gives it a stable id across renders, so the reader's
// selection survives a re-render without Argo inventing a counter to track fences by hand.
export function MermaidFence({ node, source }: { node: MarkdownNode; source: string }) {
  const context = useContext(MarkdownEvidence)
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
