import { type ReactNode, useState } from 'react'
import { cn } from '../lib/utils'
import { diffLines } from './file-diff-lines'
import { FileHeader, FileHeaderPath } from './file-header'
import { Icon } from './icon/icon'

export type FileDiff = { diff: string; path: string }
type FileDiffListVariant = 'default' | 'embedded'

const fileDiffFrameRecipes = {
  default: 'rounded-xl border',
  embedded: 'rounded-none border-0',
} as const

export function FileDiffList({
  accessibleName,
  className,
  files,
  markViewedLabel,
  renderDiff,
  viewedLabel,
  variant = 'default',
}: {
  accessibleName: string
  className?: string
  files: FileDiff[]
  markViewedLabel: (path: string) => string
  renderDiff?: (file: FileDiff) => ReactNode
  viewedLabel: string
  variant?: FileDiffListVariant
}) {
  return (
    <section
      className={cn('min-h-0 overflow-auto', fileDiffFrameRecipes[variant], className)}
      aria-label={accessibleName}
    >
      {files.map((file) => (
        <FileDiffSection
          file={file}
          key={file.path}
          markViewedLabel={markViewedLabel}
          renderDiff={renderDiff}
          viewedLabel={viewedLabel}
          variant={variant}
        />
      ))}
    </section>
  )
}

function FileDiffSection({
  file,
  markViewedLabel,
  renderDiff,
  viewedLabel,
  variant,
}: {
  file: FileDiff
  markViewedLabel: (path: string) => string
  renderDiff?: (file: FileDiff) => ReactNode
  viewedLabel: string
  variant: FileDiffListVariant
}) {
  const lines = diffLines(file.diff)
  const [viewed, setViewed] = useState(false)
  return (
    <section
      aria-label={file.path}
      className={variant === 'embedded' ? 'border-b border-border last:border-b-0' : undefined}
    >
      <header
        className={
          variant === 'default'
            ? 'sticky top-0 z-10 border-b border-border/60 bg-sidebar'
            : undefined
        }
        title={file.path}
      >
        <label className="flex w-full cursor-pointer text-left has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-inset">
          <input
            aria-label={markViewedLabel(file.path)}
            checked={viewed}
            className="sr-only"
            onChange={(event) => setViewed(event.target.checked)}
            type="checkbox"
          />
          <FileHeader
            className={
              variant === 'default' ? 'w-full border-0 bg-transparent px-4 py-3' : 'w-full'
            }
            heading={<FileHeaderPath path={file.path} />}
            titleClassName={
              variant === 'default'
                ? 'truncate text-left [direction:rtl] [unicode-bidi:plaintext]'
                : 'type-code'
            }
            variant={variant === 'embedded' ? 'inspector' : 'default'}
            rightSlotClassName="my-0 mr-0 flex shrink-0 items-center gap-2 type-label font-medium"
            rightSlot={
              <>
                <span>{viewedLabel}</span>
                <span
                  aria-hidden="true"
                  className="grid size-4 place-items-center rounded-sm border border-input data-[checked=true]:border-primary data-[checked=true]:bg-primary data-[checked=true]:text-primary-foreground"
                  data-checked={viewed}
                >
                  {viewed ? <Icon name="confirmed" className="size-3.5" /> : null}
                </span>
              </>
            }
          />
        </label>
      </header>
      {viewed
        ? null
        : (renderDiff?.(file) ?? <PlainFileDiff file={file} lines={lines} variant={variant} />)}
    </section>
  )
}

function PlainFileDiff({
  file,
  lines,
  variant,
}: {
  file: FileDiff
  lines: ReturnType<typeof diffLines>
  variant: FileDiffListVariant
}) {
  return (
    <pre
      className={cn(
        'overflow-x-auto type-code-content',
        variant === 'default'
          ? 'border-b border-border/60 bg-background last:border-b-0'
          : 'bg-transparent',
      )}
    >
      <code data-language={languageForPath(file.path)}>
        {lines.map((line) => {
          if (line.kind === 'hunk') return null
          const lineNumber = line.kind === 'removed' ? line.oldLine : line.newLine
          return (
            <span
              className={cn(
                'flex min-w-max px-3',
                line.kind === 'added' && 'bg-emerald-500/15',
                line.kind === 'removed' && 'bg-rose-500/15',
              )}
              key={`${line.kind}-${line.oldLine ?? 'x'}-${line.newLine ?? 'x'}-${line.source}`}
            >
              <span
                aria-hidden="true"
                className="mr-3 w-6 shrink-0 text-right text-muted-foreground select-none"
              >
                {lineNumber ?? ''}
              </span>
              <span>{line.source}</span>
            </span>
          )
        })}
      </code>
    </pre>
  )
}

function languageForPath(path: string) {
  const extension = path.split('.').pop()
  const languages: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    md: 'markdown',
    ts: 'typescript',
    tsx: 'tsx',
  }
  return extension ? languages[extension] : undefined
}
