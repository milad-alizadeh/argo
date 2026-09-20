import { useId, useState } from 'react'
import type { BundledLanguage } from 'shiki/langs'
import { CodeBlock } from '@/platform/renderer/components/ai-elements/code-block'
import { diffLineDecoration, diffLines } from '@/platform/renderer/components/file-diff-lines'
import { Checkbox } from '@/platform/renderer/components/ui/checkbox'
import { cn } from '@/platform/renderer/lib/utils'

export type FileDiff = { diff: string; path: string }

function fileName(path: string) {
  return path.split('/').findLast((segment) => segment.length > 0) ?? path
}

export function FileDiffList({
  accessibleName,
  className,
  files,
  languageForPath = () => null,
  markViewedLabel,
  viewedLabel,
}: {
  accessibleName: string
  className?: string
  files: FileDiff[]
  languageForPath?: (path: string) => BundledLanguage | null
  markViewedLabel: (path: string) => string
  viewedLabel: string
}) {
  return (
    <section
      className={cn('min-h-0 overflow-auto rounded-xl border', className)}
      aria-label={accessibleName}
    >
      {files.map((file) => (
        <FileDiffSection
          file={file}
          key={file.path}
          language={languageForPath(file.path)}
          markViewedLabel={markViewedLabel}
          viewedLabel={viewedLabel}
        />
      ))}
    </section>
  )
}

function FileDiffSection({
  file,
  language,
  markViewedLabel,
  viewedLabel,
}: {
  file: FileDiff
  language: BundledLanguage | null
  markViewedLabel: (path: string) => string
  viewedLabel: string
}) {
  const lines = diffLines(file.diff)
  const name = fileName(file.path)
  const [viewed, setViewed] = useState(false)
  const checkboxId = useId()
  return (
    <section aria-label={file.path}>
      <header
        className="sticky top-0 z-10 flex items-center gap-4 border-b border-border/60 bg-sidebar px-4 py-3"
        title={file.path}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate type-body font-semibold">{name}</span>
          {name === file.path ? null : (
            <span className="block truncate type-meta text-muted-foreground">{file.path}</span>
          )}
        </span>
        <label
          aria-label={markViewedLabel(file.path)}
          className="flex shrink-0 cursor-pointer items-center gap-2 type-label font-medium"
          htmlFor={checkboxId}
        >
          {viewedLabel}
          <Checkbox
            checked={viewed}
            id={checkboxId}
            onCheckedChange={(checked) => setViewed(checked === true)}
          />
        </label>
      </header>
      {viewed ? null : (
        <CodeBlock
          code={file.diff}
          language={language}
          className="rounded-none border-0 border-b border-border/60 type-code-content last:border-b-0 [&_pre]:p-0"
          line={(index) => {
            const line = lines[index] ?? { kind: 'title', oldLine: null, newLine: null }
            return diffLineDecoration(line)
          }}
        />
      )}
    </section>
  )
}
