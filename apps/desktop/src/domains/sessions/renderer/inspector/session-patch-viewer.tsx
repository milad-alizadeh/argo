import { detectCodeLanguageFromPath } from '../feed'
import { CodeBlock } from '../ai-elements'
import { useTranslation } from 'react-i18next'
import type { PatchFile } from '@/domains/sessions/contract/model'
import { diffLineDecoration, diffLines } from '@/platform/renderer/components/file-diff-lines'
import { type FileDiff, FileDiffList } from '@/platform/renderer/components/file-diff-list'

// One patch over several files: each file is its own section, its name pinned to the top of
// the panel while its hunks scroll under it, and its code coloured by its own language.
export function SessionPatchViewer({ files }: { files: PatchFile[] }) {
  const { t } = useTranslation('sessions')
  return (
    <FileDiffList
      accessibleName={t('diff.label')}
      className="min-h-0 flex-1 rounded-none border-0"
      files={files}
      markViewedLabel={(path) => t('diff.markViewed', { path })}
      renderDiff={(file) => <HighlightedFileDiff file={file} />}
      viewedLabel={t('diff.viewed')}
    />
  )
}

function HighlightedFileDiff({ file }: { file: FileDiff }) {
  const lines = diffLines(file.diff)
  return (
    <CodeBlock
      className="rounded-none border-0 border-b border-border/60 type-code-content [&_pre]:p-0"
      code={file.diff}
      language={detectCodeLanguageFromPath(file.path)?.grammar ?? null}
      line={(index) =>
        diffLineDecoration(
          lines[index] ?? { kind: 'title', newLine: null, oldLine: null, source: '' },
        )
      }
    />
  )
}
