import type { BundledLanguage } from 'shiki/langs'
import { CodeBlock } from '@/platform/renderer/components/ai-elements/code-block'
import { diffLineDecoration, diffLines } from '@/platform/renderer/components/file-diff-lines'
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
}: {
  accessibleName: string
  className?: string
  files: FileDiff[]
  languageForPath?: (path: string) => BundledLanguage | null
}) {
  return (
    <section
      className={cn('min-h-0 overflow-auto rounded-xl border', className)}
      aria-label={accessibleName}
    >
      {files.map((file) => (
        <FileDiffSection file={file} key={file.path} language={languageForPath(file.path)} />
      ))}
    </section>
  )
}

function FileDiffSection({ file, language }: { file: FileDiff; language: BundledLanguage | null }) {
  const lines = diffLines(file.diff)
  const name = fileName(file.path)
  return (
    <section aria-label={file.path}>
      <header
        className="sticky top-0 z-10 border-b border-border/60 bg-sidebar px-4 py-3"
        title={file.path}
      >
        <span className="block truncate type-body font-semibold">{name}</span>
        {name === file.path ? null : (
          <span className="block truncate type-meta text-muted-foreground">{file.path}</span>
        )}
      </header>
      <CodeBlock
        code={file.diff}
        language={language}
        className="rounded-none border-0 border-b border-border/60 type-code-content last:border-b-0 [&_pre]:p-0"
        line={(index) => {
          const line = lines[index] ?? { kind: 'title', oldLine: null, newLine: null }
          return diffLineDecoration(line)
        }}
      />
    </section>
  )
}
