import {
  Terminal,
  TerminalContent,
  TerminalCopyButton,
  TerminalHeader,
  TerminalTitle,
} from '@/components/ai-elements/terminal'
import { FeedMermaid } from '../feed/content/FeedMermaid'
import type { SessionEvidence } from '../types'

export function SessionEvidenceInspector({ evidence }: { evidence: SessionEvidence }) {
  if (evidence.shape === 'diagram')
    return (
      <section className="flex min-h-0 flex-1 flex-col" aria-label="Diagram inspector">
        <header className="sticky top-0 z-10 border-b border-border/60 bg-sidebar px-4 py-3 type-meta">
          {evidence.title}
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <FeedMermaid source={evidence.source} />
        </div>
      </section>
    )
  if (evidence.evidence === null)
    return (
      <section className="p-4 text-meta text-muted-foreground">
        Recorded evidence is unavailable.
      </section>
    )
  const { kind, source, title } = evidence.evidence
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Command and file inspector">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-sidebar px-4 py-3 type-meta">
        {title}
      </header>
      {kind === 'output' ? (
        <div className="min-h-0 overflow-auto p-4">
          <Terminal output={source}>
            <TerminalHeader>
              <TerminalTitle className="type-meta">{title}</TerminalTitle>
              <TerminalCopyButton />
            </TerminalHeader>
            <TerminalContent className="type-code" />
          </Terminal>
        </div>
      ) : (
        <pre className="min-h-0 overflow-auto p-4 type-code whitespace-pre-wrap">{source}</pre>
      )}
    </section>
  )
}
