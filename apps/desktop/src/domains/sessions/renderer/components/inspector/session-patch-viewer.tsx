import { useTranslation } from 'react-i18next'
import type { PatchFile } from '@/domains/sessions/contract/patch-files'
import { detectCodeLanguageFromPath } from '@/domains/sessions/renderer/feed/content/code-language'
import { FileDiffList } from '@/platform/renderer/components/file-diff-list'

// One patch over several files: each file is its own section, its name pinned to the top of
// the panel while its hunks scroll under it, and its code coloured by its own language.
export function SessionPatchViewer({ files }: { files: PatchFile[] }) {
  const { t } = useTranslation('sessions')
  return (
    <FileDiffList
      accessibleName={t('diff.label')}
      className="flex-1 rounded-none border-0"
      files={files}
      languageForPath={(path) => detectCodeLanguageFromPath(path)?.grammar ?? null}
      markViewedLabel={(path) => t('diff.markViewed', { path })}
      viewedLabel={t('diff.viewed')}
    />
  )
}
