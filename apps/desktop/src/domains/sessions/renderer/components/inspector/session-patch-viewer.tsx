import { useTranslation } from 'react-i18next'
import { CodeBlock } from '../../../../../platform/renderer/components/ai-elements/code-block'
import type { PatchFile } from '../../../main/patch-files'
import { detectCodeLanguageFromPath } from '../../feed/content/code-language'
import { diffLineDecoration, diffLines } from './session-diff-lines'

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
