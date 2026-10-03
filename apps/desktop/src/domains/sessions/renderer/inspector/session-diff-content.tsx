import type { RefObject } from 'react'
import type { BundledLanguage } from 'shiki/langs'
import { diffLineDecoration, diffLines } from '@/platform/renderer/components/file-diff-lines'
import { FileHeader, FileHeaderPath } from '@/platform/renderer/components/file-header'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import { CodeBlock, CodeBlockContext, CodeBlockCopyButton } from '../ai-elements'
import { inspectorBodyRecipe } from './inspector-recipes'

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
  return (
    <CodeBlockContext.Provider value={content ?? ''}>
      <DiffHeader
        copyLabel={typeof content === 'string' ? text.copy : undefined}
        label={text.toggle}
        onClick={onShowDiff}
        path={path}
        viewButtonReference={viewButtonReference}
      />
      {content === undefined || content === null ? (
        <p className={`${inspectorBodyRecipe} type-meta text-muted-foreground`}>
          {content === undefined ? text.reading : text.unavailable}
        </p>
      ) : (
        <CodeBlock
          code={content}
          language={language}
          className="flex min-h-0 flex-1 flex-col"
          contentClassName="min-h-0 flex-1"
          variant="embedded"
        />
      )}
    </CodeBlockContext.Provider>
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
      className="flex min-h-0 flex-1 flex-col"
      contentClassName="min-h-0 flex-1 p-0"
      variant="embedded"
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
  // Isolated so a path's leading slash stays at its start while the start truncates.
  return (
    <FileHeader
      className="shrink-0"
      titleClassName="type-code"
      heading={<FileHeaderPath path={path} />}
      variant="inspector"
      rightSlot={
        <>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={label}
            onClick={onClick}
            ref={viewButtonReference}
          >
            <Icon name={iconName} size="control" />
          </Button>
          {copyLabel === undefined ? null : <CodeBlockCopyButton aria-label={copyLabel} />}
        </>
      }
    />
  )
}
