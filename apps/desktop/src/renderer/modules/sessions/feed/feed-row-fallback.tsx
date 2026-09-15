import { useTranslation } from 'react-i18next'
import { PromptText } from '../prompt/prompt-text'
import type { SessionEvidence, SessionFeedRow } from '../types'
import { FeedDelegation } from './feed-delegation'
import { FeedEvent } from './feed-event'
import { FeedMarker } from './feed-marker'

export function PlainText({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap break-words">{text}</p>
}

export function FeedPrompt({
  onOpenEvidence,
  text,
}: {
  onOpenEvidence: (evidence: SessionEvidence) => void
  text: string
}) {
  const { t } = useTranslation('sessions')
  return (
    <p
      className="max-w-full rounded-xl border border-transparent bg-muted px-3 py-2 type-prose sm:max-w-4/5"
      data-slot="bubble"
      data-variant="muted"
    >
      <span className="sr-only">{t('promptSender')}</span>
      <PromptText
        onOpenSkill={({ name, path }) =>
          onOpenEvidence({ shape: 'skill', id: `skill:${path}`, name, path })
        }
        text={text}
      />
    </p>
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
