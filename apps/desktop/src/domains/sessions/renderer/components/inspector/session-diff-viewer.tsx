import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { detectCodeLanguageFromPath } from '../../feed/content/code-language'
import { CurrentFileContent, DiffContent } from './session-diff-content'

export function SessionDiffViewer({
  path,
  sessionId,
  source,
}: {
  path: string
  sessionId: string | null
  source: string
}) {
  const { t } = useTranslation('sessions')
  const [view, setView] = useState<'diff' | 'file'>('diff')
  const [content, setContent] = useState<string | null | undefined>(undefined)
  const currentFileButtonReference = useRef<HTMLButtonElement>(null)
  const diffButtonReference = useRef<HTMLButtonElement>(null)
  const shouldRestoreFocus = useRef(false)
  const language = detectCodeLanguageFromPath(path)?.grammar ?? null
  useLayoutEffect(() => {
    if (!shouldRestoreFocus.current) return
    shouldRestoreFocus.current = false
    if (view === 'diff') currentFileButtonReference.current?.focus()
    else diffButtonReference.current?.focus()
  }, [view])
  const showDiff = () => {
    shouldRestoreFocus.current = true
    setView('diff')
  }
  const showCurrentFile = () => {
    shouldRestoreFocus.current = true
    setView('file')
    if (sessionId === null) return setContent(null)
    void window.argo
      .readWorkspaceFile({ sessionId, path })
      .then((reply) => setContent(reply.type === 'session.file.read' ? reply.content : null))
  }
  if (view === 'file')
    return (
      <section className="flex min-h-0 flex-1 flex-col" aria-label={t('diff.currentFile')}>
        <CurrentFileContent
          content={content}
          language={language}
          onShowDiff={showDiff}
          path={path}
          text={{
            copy: t('diff.copyFile'),
            toggle: t('diff.diff'),
            unavailable: t('diff.fileUnavailable'),
            reading: t('diff.readingFile'),
          }}
          viewButtonReference={diffButtonReference}
        />
      </section>
    )
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={t('diff.label')}>
      <DiffContent
        language={language}
        onShowCurrentFile={showCurrentFile}
        path={path}
        source={source}
        text={{ copy: t('diff.copyDiff'), toggle: t('diff.currentFile') }}
        viewButtonReference={currentFileButtonReference}
      />
    </section>
  )
}
