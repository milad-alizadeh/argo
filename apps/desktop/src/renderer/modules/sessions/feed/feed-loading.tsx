import { useTranslation } from 'react-i18next'
import './feed-loading.css'

// A Feed still loading. The comet stays hidden for a moment, so a quick Session switch shows none.
export function FeedLoading({ state }: { state: 'loading' | 'running' }) {
  const { t } = useTranslation('sessions')
  return (
    <section className="feed-loading" data-state={state}>
      <span aria-label={t('feedLoading')} className="feed-loading__comet" role="status" />
    </section>
  )
}
