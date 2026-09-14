import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@/components/ai-elements/code-block'
import { CodeBlockCopyButton } from '@/components/ai-elements/code-block-copy-button'
import { Button } from '@/renderer/components/ui/button'
import { detectCodeLanguageFromPath } from '../feed/content/codeLanguage'

type DiffLine = {
  kind: 'added' | 'context' | 'removed' | 'title'
  newLine: number | null
  oldLine: number | null
}

function hunkStart(line: string) {
  const matched = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
  return matched === null ? null : { oldLine: Number(matched[1]), newLine: Number(matched[2]) }
}

function diffLines(source: string): DiffLine[] {
  let oldLine = 0
  let newLine = 0
  return source
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => {
      const start = hunkStart(line)
      if (start !== null) {
        oldLine = start.oldLine
        newLine = start.newLine
        return { kind: 'title', oldLine: null, newLine: null }
      }
      if (line.startsWith('-')) return { kind: 'removed', oldLine: oldLine++, newLine: null }
      if (line.startsWith('+')) return { kind: 'added', oldLine: null, newLine: newLine++ }
      if (line.startsWith(' ')) return { kind: 'context', oldLine: oldLine++, newLine: newLine++ }
      return { kind: 'title', oldLine: null, newLine: null }
    })
}

function lineNumbers(line: DiffLine) {
  return (
    <span
      aria-hidden="true"
      className="mr-2 grid w-12 shrink-0 grid-cols-2 gap-1 text-right text-muted-foreground select-none"
    >
      <span>{line.oldLine ?? ''}</span>
      <span>{line.newLine ?? ''}</span>
    </span>
  )
}

function lineClass(line: DiffLine) {
  switch (line.kind) {
    case 'added':
      return 'bg-emerald-500/15 [&_span:last-child]:bg-emerald-500/10'
    case 'removed':
      return 'bg-rose-500/15 [&_span:last-child]:bg-rose-500/10'
    case 'context':
    case 'title':
      return undefined
  }
}

function currentFileContent({
  content,
  language,
  path,
  text,
}: {
  content: string | null | undefined
  language: ReturnType<typeof detectCodeLanguageFromPath>
  path: string
  text: { copyFile: string; unavailable: string; reading: string }
}) {
  if (content === undefined)
    return <p className="p-4 type-meta text-muted-foreground">{text.reading}</p>
  if (content === null)
    return <p className="p-4 type-meta text-muted-foreground">{text.unavailable}</p>
  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <CodeBlock code={content} language={language?.grammar ?? null} className="type-code-content">
        <CodeBlockHeader className="bg-muted type-meta">
          <CodeBlockTitle>
            <CodeBlockFilename>{path}</CodeBlockFilename>
          </CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton aria-label={text.copyFile} className="size-7" />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>
    </div>
  )
}

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
  const language = detectCodeLanguageFromPath(path)
  const lines = diffLines(source)
  if (view === 'file') {
    return (
      <section className="flex min-h-0 flex-1 flex-col" aria-label={t('diff.currentFile')}>
        <header className="flex items-center justify-between border-b border-border/60 bg-sidebar px-4 py-3 type-meta">
          <span className="truncate">{path}</span>
          <Button size="sm" variant="ghost" onClick={() => setView('diff')}>
            {t('diff.diff')}
          </Button>
        </header>
        {currentFileContent({
          content,
          language,
          path,
          text: {
            copyFile: t('diff.copyFile'),
            unavailable: t('diff.fileUnavailable'),
            reading: t('diff.readingFile'),
          },
        })}
      </section>
    )
  }
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={t('diff.label')}>
      <header className="flex items-center justify-between border-b border-border/60 bg-sidebar px-4 py-3 type-meta">
        <span className="truncate">{path}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setView('file')
            if (sessionId === null) return setContent(null)
            void window.argo
              .readWorkspaceFile({ sessionId, path })
              .then((reply) =>
                setContent(reply.type === 'session.file.read' ? reply.content : null),
              )
          }}
        >
          {t('diff.currentFile')}
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <CodeBlock
          code={source}
          language={language?.grammar ?? null}
          className="type-code-content"
          line={(index) => ({
            className: lineClass(lines[index] ?? { kind: 'title', oldLine: null, newLine: null }),
            prefix: lineNumbers(lines[index] ?? { kind: 'title', oldLine: null, newLine: null }),
          })}
        >
          <CodeBlockHeader className="bg-muted type-meta">
            <CodeBlockTitle>
              <CodeBlockFilename>{path}</CodeBlockFilename>
            </CodeBlockTitle>
            <CodeBlockActions>
              <CodeBlockCopyButton aria-label={t('diff.copyDiff')} className="size-7" />
            </CodeBlockActions>
          </CodeBlockHeader>
        </CodeBlock>
      </div>
    </section>
  )
}
