import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { CodeBlock } from '../ai-elements'
import { detectCodeLanguageFromPath, FeedMarkdown } from '../feed/content'
import type { SessionFileEvidence } from '../types'
import { InspectorPathHeader } from './inspector-path-header'
import { inspectorBodyRecipe } from './inspector-recipes'

const MARKDOWN_FILE = /\.(md|markdown)$/i

// The file is read inside the Session's workspace, so no Session means nothing to read.
function useWorkspaceFile(sessionId: string | null, path: string) {
  const [content, setContent] = useState<{ path: string; text: string | null } | null>(null)
  useEffect(() => {
    let current = true
    const read =
      sessionId === null
        ? Promise.resolve(null)
        : trpcClient.sessionWorkspaceFileRead
            .query({ sessionId, path })
            .then((reply) => reply.content)
    void read.then((text) => {
      if (current) setContent({ path, text })
    })
    return () => {
      current = false
    }
  }, [path, sessionId])
  return content?.path === path ? content : null
}

function FileBody({ path, sessionId }: { path: string; sessionId: string | null }) {
  const { t } = useTranslation('sessions')
  const content = useWorkspaceFile(sessionId, path)
  if (content === null)
    return <p className="type-meta text-muted-foreground">{t('file.reading')}</p>
  if (content.text === null)
    return <p className="type-meta text-muted-foreground">{t('file.unavailable')}</p>
  if (MARKDOWN_FILE.test(path)) return <FeedMarkdown text={content.text} />
  return (
    <CodeBlock
      code={content.text}
      language={detectCodeLanguageFromPath(path)?.grammar ?? null}
      contentClassName="p-0"
      variant="embedded"
    />
  )
}

export function SessionFileInspector({
  evidence,
  sessionId,
}: {
  evidence: SessionFileEvidence
  sessionId: string | null
}) {
  const { t } = useTranslation('sessions')
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={t('file.inspector')}>
      <InspectorPathHeader path={evidence.path} />
      <div className={inspectorBodyRecipe}>
        <FileBody path={evidence.path} sessionId={sessionId} />
      </div>
    </section>
  )
}
