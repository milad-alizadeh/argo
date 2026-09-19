import { useTranslation } from 'react-i18next'
import type { PatchFile } from '@/domains/sessions/contract/patch-files'
import {
  diffLineDecoration,
  diffLines,
} from '@/domains/sessions/renderer/components/inspector/session-diff-lines'
import { detectCodeLanguageFromPath } from '@/domains/sessions/renderer/feed/content/code-language'
import { CodeBlock } from '@/platform/renderer/components/ai-elements/code-block'

function fileName(path: string) {
  return path.split('/').findLast((segment) => segment.length > 0) ?? path
}

// One patch over several files: each file is its own section, its name pinned to the top of
// the panel while its hunks scroll under it, and its code coloured by its own language.
export function SessionPatchViewer({ files }: { files: PatchFile[] }) {
  const { t } = useTranslation('sessions')
  return (
    <section className="min-h-0 flex-1 overflow-auto" aria-label={t('diff.label')}>
      {files.map((file) => (
        <PatchFileSection file={file} key={file.path} />
      ))}
    </section>
  )
}

function PatchFileSection({ file }: { file: PatchFile }) {
  const lines = diffLines(file.diff)
  return (
    <section aria-label={file.path}>
      <header
        className="sticky top-0 z-10 border-b border-border/60 bg-sidebar px-4 py-3"
        title={file.path}
      >
        <span className="block truncate type-body font-semibold">{fileName(file.path)}</span>
      </header>
      <CodeBlock
        code={file.diff}
        language={detectCodeLanguageFromPath(file.path)?.grammar ?? null}
        className="rounded-none border-0 border-b border-border/60 type-code-content [&_pre]:p-0"
        line={(index) => {
          const line = lines[index] ?? { kind: 'title', oldLine: null, newLine: null }
          return diffLineDecoration(line)
        }}
      />
    </section>
  )
}
