import { useTranslation } from 'react-i18next'
import { diffLineDecoration, diffLines } from '@/platform/renderer/components/file-diff-lines'
import { type FileDiff, FileDiffList } from '@/platform/renderer/components/file-diff-list'
import { CodeBlock } from '../ai-elements'
import { detectCodeLanguageFromPath } from '../feed/content'
import type { PatchFile } from '../model'

// Each patch file keeps its name and hunks together in the inspector's single scrolling list.
export function SessionPatchViewer({ files }: { files: PatchFile[] }) {
  const { t } = useTranslation('sessions')
  return (
    <FileDiffList
      accessibleName={t('diff.label')}
      className="min-h-0 flex-1"
      files={files}
      markViewedLabel={(path) => t('diff.markViewed', { path })}
      renderDiff={(file) => <HighlightedFileDiff file={file} />}
      viewedLabel={t('diff.viewed')}
      variant="embedded"
    />
  )
}

function HighlightedFileDiff({ file }: { file: FileDiff }) {
  const lines = diffLines(file.diff)
  return (
    <CodeBlock
      contentClassName="p-0"
      code={file.diff}
      language={detectCodeLanguageFromPath(file.path)?.grammar ?? null}
      variant="embedded"
      line={(index) =>
        diffLineDecoration(
          lines[index] ?? { kind: 'title', newLine: null, oldLine: null, source: '' },
        )
      }
    />
  )
}
