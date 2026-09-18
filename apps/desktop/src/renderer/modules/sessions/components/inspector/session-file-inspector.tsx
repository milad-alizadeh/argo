import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CodeBlock } from '@/components/ai-elements/code-block'
import { detectCodeLanguageFromPath } from '../../feed/content/code-language'
import { FeedMarkdown } from '../../feed/content/feed-markdown'
import type { SessionFileEvidence } from '../../types'

const MARKDOWN_FILE = /\.(md|markdown)$/i

// The file is read inside the Session's workspace, so no Session means nothing to read.
function useWorkspaceFile(sessionId: string | null, path: string) {
  const [content, setContent] = useState<{ path: string; text: string | null } | null>(null)
  useEffect(() => {
    let current = true
    const read =
      sessionId === null
        ? Promise.resolve(null)
        : window.argo
            .readWorkspaceFile({ sessionId, path })
            .then((reply) => (reply.type === 'session.file.read' ? reply.content : null))
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
      className="type-code-content bg-card"
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
      <header className="sticky top-0 z-10 border-b border-border/60 bg-sidebar px-4 py-3">
        <span className="block truncate text-left [direction:rtl] type-body font-semibold">
          {evidence.path}
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <FileBody path={evidence.path} sessionId={sessionId} />
      </div>
    </section>
  )
}
