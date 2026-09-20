import { Check } from 'lucide-react'
import { useState } from 'react'
import type { BundledLanguage } from 'shiki/langs'
import { CodeBlock } from '@/platform/renderer/components/ai-elements/code-block'
import { diffLineDecoration, diffLines } from '@/platform/renderer/components/file-diff-lines'
import { cn } from '@/platform/renderer/lib/utils'

export type FileDiff = { diff: string; path: string }

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
  const [viewed, setViewed] = useState(false)
  return (
    <section aria-label={file.path}>
      <header className="sticky top-0 z-10 border-b border-border/60 bg-sidebar" title={file.path}>
        <label className="flex w-full cursor-pointer items-center gap-4 px-4 py-3 text-left has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-inset">
          <input
            aria-label={markViewedLabel(file.path)}
            checked={viewed}
            className="sr-only"
            onChange={(event) => setViewed(event.target.checked)}
            type="checkbox"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-left type-body font-semibold [direction:rtl] [unicode-bidi:plaintext]">
              {file.path}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 type-label font-medium">
            {viewedLabel}
            <span
              aria-hidden="true"
              className="grid size-4 place-items-center rounded-sm border border-input data-[checked=true]:border-primary data-[checked=true]:bg-primary data-[checked=true]:text-primary-foreground"
              data-checked={viewed}
            >
              {viewed ? <Check className="size-3.5" /> : null}
            </span>
          </span>
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
