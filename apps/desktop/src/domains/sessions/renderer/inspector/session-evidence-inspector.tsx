import { FeedMermaid, detectCodeLanguageFromPath } from '../feed'
import { CodeBlock } from '../ai-elements'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { patchFiles } from '@/domains/sessions/contract/model'
import type { SessionEvidence } from '../types'
import { InspectorTerminal } from './inspector-terminal'
import { SessionDiffViewer } from './session-diff-viewer'
import { SessionFileInspector } from './session-file-inspector'
import { SessionPatchViewer } from './session-patch-viewer'
import { SessionSkillInspector } from './session-skill-inspector'

// A long path truncates at its start, so the filename at the end stays visible.
function InspectorTitle({ title }: { title: string }) {
  return (
    <span className="block truncate text-left [direction:rtl] type-body font-semibold">
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
  const { t } = useTranslation('sessions')
  if (evidence.shape === 'skill') return <SessionSkillInspector evidence={evidence} />
  if (evidence.shape === 'file')
    return <SessionFileInspector evidence={evidence} sessionId={sessionId} />
  if (evidence.shape === 'diagram')
    return (
      <section className="flex min-h-0 flex-1 flex-col" aria-label={t('inspector.diagramLabel')}>
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
      <section className="p-4 type-meta text-muted-foreground">
        {t('inspector.evidenceUnavailable')}
      </section>
    )
  const { kind, source, title } = evidence.evidence
  if (kind === 'diff') {
    const files = patchFiles(source, title)
    const [file] = files
    if (files.length > 1 || file === undefined) return <SessionPatchViewer files={files} />
    return <SessionDiffViewer path={file.path} sessionId={sessionId} source={file.diff} />
  }
  let content: ReactNode
  if (kind === 'output') {
    content = <InspectorTerminal output={source} />
  } else {
    const language = detectCodeLanguageFromPath(title)?.grammar ?? null
    content = (
      <div className="min-h-0 overflow-auto p-4">
        <CodeBlock code={source} language={language} className="type-code-content bg-card" />
      </div>
    )
  }
  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      aria-label={t('inspector.commandAndFileLabel')}
    >
      <header className="sticky top-0 z-10 border-b border-border/60 bg-sidebar px-4 py-3">
        <InspectorTitle title={title} />
      </header>
      {content}
    </section>
  )
}
