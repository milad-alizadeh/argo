import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FileHeader, FileHeaderPath } from '@/platform/renderer/components/file-header'
import { CodeBlock } from '../ai-elements'
import { detectCodeLanguageFromPath, FeedMermaid } from '../feed/content'
import { patchFiles } from '../model'
import type { SessionEvidence } from '../types'
import { inspectorBodyRecipe, inspectorHeaderPlacement } from './inspector-recipes'
import { InspectorTerminal } from './inspector-terminal'
import { SessionDiffViewer } from './session-diff-viewer'
import { SessionFileInspector } from './session-file-inspector'
import { SessionPatchViewer } from './session-patch-viewer'
import { SessionSkillInspector } from './skill'

// A long path truncates at its start, so the filename at the end stays visible.
function InspectorTitle({ title, path = false }: { title: string; path?: boolean }) {
  return (
    <FileHeader
      heading={path ? <FileHeaderPath path={title} /> : title}
      titleClassName={path ? 'type-code' : undefined}
      variant="inspector"
    />
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
        <header className={inspectorHeaderPlacement}>
          <InspectorTitle title={evidence.title} />
        </header>
        <div className={inspectorBodyRecipe}>
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
      <div className={inspectorBodyRecipe}>
        <CodeBlock code={source} contentClassName="p-0" language={language} variant="embedded" />
      </div>
    )
  }
  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      aria-label={t('inspector.commandAndFileLabel')}
    >
      <header className={inspectorHeaderPlacement}>
        <InspectorTitle path={kind === 'document'} title={title} />
      </header>
      {content}
    </section>
  )
}
