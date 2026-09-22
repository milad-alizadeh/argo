import { CodeBlock, CodeBlockActions, CodeBlockFilename, CodeBlockHeader, CodeBlockTitle, CodeBlockCopyButton } from '../ai-elements'
import type { RefObject } from 'react'
import type { BundledLanguage } from 'shiki/langs'
import { diffLineDecoration, diffLines } from '@/platform/renderer/components/file-diff-lines'
import { Icon } from '@/platform/renderer/components/icon'
import { Button } from '@/platform/renderer/components/ui/button'

type ViewButtonReference = RefObject<HTMLButtonElement | null>
type Text = { copy: string; toggle: string }

export function CurrentFileContent({
  content,
  language,
  onShowDiff,
  path,
  text,
  viewButtonReference,
}: {
  content: string | null | undefined
  language: BundledLanguage | null
  onShowDiff: () => void
  path: string
  text: Text & { unavailable: string; reading: string }
  viewButtonReference: ViewButtonReference
}) {
  if (content === undefined || content === null)
    return (
      <>
        <DiffHeader
          label={text.toggle}
          onClick={onShowDiff}
          path={path}
          viewButtonReference={viewButtonReference}
        />
        <p className="min-h-0 flex-1 overflow-auto p-4 type-meta text-muted-foreground">
          {content === undefined ? text.reading : text.unavailable}
        </p>
      </>
    )
  return (
    <CodeBlock
      code={content}
      language={language}
      className="flex min-h-0 flex-1 flex-col rounded-none border-0 type-code-content [&_pre]:min-h-0 [&_pre]:flex-1"
    >
      <DiffHeader
        copyLabel={text.copy}
        label={text.toggle}
        onClick={onShowDiff}
        path={path}
        viewButtonReference={viewButtonReference}
      />
    </CodeBlock>
  )
}

export function DiffContent({
  language,
  onShowCurrentFile,
  path,
  source,
  text,
  viewButtonReference,
}: {
  language: BundledLanguage | null
  onShowCurrentFile: () => void
  path: string
  source: string
  text: Text
  viewButtonReference: ViewButtonReference
}) {
  const lines = diffLines(source)
  return (
    <CodeBlock
      code={source}
      language={language}
      className="flex min-h-0 flex-1 flex-col rounded-none border-0 type-code-content [&_pre]:min-h-0 [&_pre]:flex-1 [&_pre]:p-0"
      line={(index) => {
        const line = lines[index] ?? {
          kind: 'title',
          newLine: null,
          oldLine: null,
          source: '',
        }
        return diffLineDecoration(line)
      }}
    >
      <DiffHeader
        copyLabel={text.copy}
        label={text.toggle}
        onClick={onShowCurrentFile}
        path={path}
        viewButtonReference={viewButtonReference}
      />
    </CodeBlock>
  )
}

function DiffHeader({
  copyLabel,
  label,
  onClick,
  path,
  viewButtonReference,
}: {
  copyLabel?: string
  label: string
  onClick: () => void
  path: string
  viewButtonReference: ViewButtonReference
}) {
  const iconName = copyLabel === undefined ? 'diff-view' : 'file-text'
  return (
    <CodeBlockHeader className="shrink-0 bg-sidebar px-4 py-3">
      <CodeBlockTitle className="min-w-0">
        <CodeBlockFilename className="block truncate text-left [direction:rtl] type-body font-semibold">
          {path}
        </CodeBlockFilename>
      </CodeBlockTitle>
      <CodeBlockActions>
        <Button
          size="icon"
          variant="ghost"
          aria-label={label}
          onClick={onClick}
          ref={viewButtonReference}
        >
          <Icon name={iconName} size="control" />
        </Button>
        {copyLabel === undefined ? null : (
          <CodeBlockCopyButton aria-label={copyLabel} className="size-7" />
        )}
      </CodeBlockActions>
    </CodeBlockHeader>
  )
}
