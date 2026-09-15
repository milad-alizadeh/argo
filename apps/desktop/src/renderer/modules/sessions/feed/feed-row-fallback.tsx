import { useTranslation } from 'react-i18next'
import { PromptText } from '../prompt/prompt-text'
import type { SessionEvidence, SessionFeedRow } from '../types'
import { FeedImage } from './content/feed-images'
import { FeedDelegation } from './feed-delegation'
import { FeedEvent } from './feed-event'
import { FeedMarker } from './feed-marker'

export function PlainText({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap break-words">{text}</p>
}

// Biome refuses a position key, and the same picture can be pasted twice: count earlier copies.
function keyedImages(images: readonly string[]) {
  const seen = new Map<string, number>()
  return images.map((url, position) => {
    const occurrence = seen.get(url) ?? 0
    seen.set(url, occurrence + 1)
    return { url, key: `${occurrence}:${url}`, number: position + 1 }
  })
}

export function FeedPrompt({
  onOpenEvidence,
  text,
  images = [],
}: {
  onOpenEvidence: (evidence: SessionEvidence) => void
  text: string
  images?: readonly string[]
}) {
  const { t } = useTranslation('sessions')
  return (
    <div
      className="flex max-w-full flex-col items-end gap-(--spacing-tight) rounded-xl border border-transparent bg-muted px-3 py-2 type-prose sm:max-w-4/5"
      data-slot="bubble"
      data-variant="muted"
    >
      <span className="sr-only">{t('promptSender')}</span>
      {images.length === 0 ? null : (
        <div className="flex flex-wrap justify-end gap-(--spacing-tight)">
          {keyedImages(images).map(({ url, key, number }) => (
            <FeedImage
              alt={t('promptImage', { number })}
              openLabel={t('promptImageOpen', { number })}
              compact
              key={key}
              source={url}
            />
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
    </div>
  )
}

export function FeedRowFallback({
  row,
}: {
  row: Exclude<SessionFeedRow, { shape: 'tool' | 'tool-group' | 'prose' | 'ask' }>
}) {
  const { t } = useTranslation('sessions')
  switch (row.shape) {
    case 'thought':
      return <PlainText text={row.text} />
    case 'command-output':
      return <PlainText text={row.text} />
    case 'event':
      return <FeedEvent row={row} />
    case 'delegation':
    case 'delegation-group':
      return <FeedDelegation row={row} />
    case 'source':
      return <p>{row.label}</p>
    case 'marker':
      return <FeedMarker row={row} />
    case 'unreadable':
      return <p>{t('rowUnreadable')}</p>
  }
}
