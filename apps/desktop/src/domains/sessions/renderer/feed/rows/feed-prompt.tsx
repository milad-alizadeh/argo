import { useTranslation } from 'react-i18next'
import { AttachmentChip } from '../../attachment-chip'
import { PromptText } from '../../prompt/prompt-text'
import type { SessionEvidence } from '../../types'
import { FeedImage } from '../content/feed-images'
import { FeedMarkdown } from '../content/feed-markdown'
import { CollapsibleText } from '../tools/collapsible-text'

// Biome refuses a position key, and the same file can be attached twice: count earlier copies.
function keyedAttachments(sources: readonly string[]) {
  const seen = new Map<string, number>()
  return sources.map((source, position) => {
    const occurrence = seen.get(source) ?? 0
    seen.set(source, occurrence + 1)
    return { source, key: `${occurrence}:${source}`, number: position + 1 }
  })
}

export function FeedPrompt({
  activeEvidenceId,
  onOpenEvidence,
  rowId,
  text,
  images = [],
  files = [],
  pastedContent = [],
}: {
  activeEvidenceId: string | null
  onOpenEvidence: (evidence: SessionEvidence) => void
  rowId: string
  text: string
  images?: readonly string[]
  files?: readonly string[]
  pastedContent?: readonly { id: string; text: string }[]
}) {
  const { t } = useTranslation('sessions')
  return (
    <div
      className="flex min-w-0 max-w-full flex-col items-end gap-(--spacing-tight) rounded-xl border border-transparent bg-muted px-3 py-2 type-prose sm:max-w-4/5"
      data-slot="bubble"
      data-variant="muted"
    >
      <span className="sr-only">{t('promptSender')}</span>
      {images.length === 0 ? null : (
        <div className="flex flex-wrap justify-end gap-(--spacing-tight)">
          {keyedAttachments(images).map(({ source, key, number }) => (
            <FeedImage
              alt={t('promptImage', { number })}
              openLabel={t('promptImageOpen', { number })}
              compact
              key={key}
              source={source}
            />
          ))}
        </div>
      )}
      {files.length === 0 ? null : (
        <div className="flex flex-wrap justify-end gap-(--spacing-tight)">
          {keyedAttachments(files).map(({ source, key }) => (
            <AttachmentChip key={key} path={source} />
          ))}
        </div>
      )}
      {text === '' ? null : (
        <p className="self-start">
          <PromptText
            onOpenSkill={({ name, path }) =>
              onOpenEvidence({ shape: 'skill', id: `skill:${path}`, name, path })
            }
            text={text}
          />
        </p>
      )}
      {pastedContent.map(({ id, text: content }) => (
        <div className="w-full min-w-0" key={`${rowId}:${id}`}>
          <CollapsibleText
            content={
              <FeedMarkdown
                activeEvidenceId={activeEvidenceId}
                onOpenEvidence={onOpenEvidence}
                rowId={`${rowId}:pasted-content:${id}`}
                text={content}
              />
            }
            contentVariant="flush"
            icon="file"
            title={t('pastedContent')}
          />
        </div>
      ))}
    </div>
  )
}
