import type { ReactNode } from 'react'
import { CodeBlock } from '@/components/ai-elements/code-block'
import {
  Terminal,
  TerminalContent,
  TerminalCopyButton,
  TerminalHeader,
  TerminalTitle,
} from '@/components/ai-elements/terminal'
import { detectCodeLanguageFromPath } from '../feed/content/codeLanguage'
import { FeedMermaid } from '../feed/content/FeedMermaid'
import type { SessionEvidence } from '../types'
import { SessionDiffViewer } from './SessionDiffViewer'
import { SessionSkillInspector } from './SessionSkillInspector'

// A long file path reads best truncated at its start, so the filename at the end stays visible;
// `direction: rtl` puts the ellipsis there while `text-align: left` keeps the visible text ltr.
function InspectorTitle({ title }: { title: string }) {
  return (
    <span
      className="block overflow-hidden text-ellipsis whitespace-nowrap text-left type-body font-semibold"
      dir="rtl"
    >
      {title}
    </span>
  )
}

export function SessionEvidenceInspector({
  evidence,
  sessionId,
}: {
  evidence: SessionEvidence
  sessionId: string | null
}) {
  if (evidence.shape === 'skill') return <SessionSkillInspector evidence={evidence} />
  if (evidence.shape === 'diagram')
    return (
      <section className="flex min-h-0 flex-1 flex-col" aria-label="Diagram inspector">
        <header className="sticky top-0 z-10 border-b border-border/60 bg-sidebar px-4 py-3">
          <InspectorTitle title={evidence.title} />
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
  if (kind === 'diff')
    return <SessionDiffViewer path={title} sessionId={sessionId} source={source} />
  let content: ReactNode
  if (kind === 'output') {
    content = (
      <div className="min-h-0 overflow-auto p-4">
        <Terminal output={source}>
          <TerminalHeader>
            <TerminalTitle className="type-meta">{title}</TerminalTitle>
            <TerminalCopyButton />
          </TerminalHeader>
          <TerminalContent className="type-code" />
        </Terminal>
      </div>
    )
  } else {
    const language = detectCodeLanguageFromPath(title)?.grammar ?? null
    content = (
      <div className="min-h-0 overflow-auto p-4">
        <CodeBlock code={source} language={language} className="type-code-content bg-card" />
      </div>
    )
  }
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Command and file inspector">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-sidebar px-4 py-3">
        <InspectorTitle title={title} />
      </header>
      {content}
    </section>
  )
}
