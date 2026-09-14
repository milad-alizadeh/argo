import { useState } from 'react'
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

function currentFileContent(
  content: string | null | undefined,
  language: ReturnType<typeof detectCodeLanguageFromPath>,
  path: string,
) {
  if (content === undefined)
    return <p className="p-4 type-meta text-muted-foreground">Reading current file…</p>
  if (content === null)
    return <p className="p-4 type-meta text-muted-foreground">Current file is unavailable.</p>
  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <CodeBlock code={content} language={language?.grammar ?? null} className="type-code-content">
        <CodeBlockHeader className="bg-muted type-meta">
          <CodeBlockTitle>
            <CodeBlockFilename>{path}</CodeBlockFilename>
          </CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton aria-label="Copy file" className="size-7" />
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
  const [view, setView] = useState<'diff' | 'file'>('diff')
  const [content, setContent] = useState<string | null | undefined>(undefined)
  const language = detectCodeLanguageFromPath(path)
  const lines = diffLines(source)
  if (view === 'file') {
    return (
      <section className="flex min-h-0 flex-1 flex-col" aria-label="Current file">
        <header className="flex items-center justify-between border-b border-border/60 bg-sidebar px-4 py-3 type-meta">
          <span className="truncate">{path}</span>
          <Button size="sm" variant="ghost" onClick={() => setView('diff')}>
            Diff
          </Button>
        </header>
        {currentFileContent(content, language, path)}
      </section>
    )
  }
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="File diff">
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
          Current file
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
              <CodeBlockCopyButton aria-label="Copy diff" className="size-7" />
            </CodeBlockActions>
          </CodeBlockHeader>
        </CodeBlock>
      </div>
    </section>
  )
}
