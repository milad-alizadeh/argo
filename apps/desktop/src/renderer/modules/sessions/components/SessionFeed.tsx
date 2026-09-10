import { useTranslation } from 'react-i18next'

import type { SessionFeed as SessionFeedData } from '../types'

import { SessionFeedRow } from './SessionFeedRow'
import { SessionsEmptyState } from './SessionsEmptyState'

type SessionFeedProps = { feed: SessionFeedData | null; error: string | null }

export function SessionFeed({ feed, error }: SessionFeedProps) {
  const { t } = useTranslation()

  if (error !== null) return <SessionsEmptyState message={error} />
  if (feed === null) return <SessionsEmptyState message={t('selectSession')} />
  if (feed.rows.length === 0) return <SessionsEmptyState message={t('emptyFeed')} />
  return (
    <section aria-label={t('activityLabel')} className="min-h-full bg-canvas">
      {feed.rows.map((row) => (
        <SessionFeedRow key={row.id} row={row} />
      ))}
    </section>
  )
}
