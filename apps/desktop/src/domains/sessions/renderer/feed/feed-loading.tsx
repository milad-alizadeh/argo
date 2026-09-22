import { useTranslation } from 'react-i18next'
import { Loader } from '@/platform/renderer/components/loader/loader'
import './feed-loading.css'

// A Feed still loading. The mark stays hidden for a moment, so a quick Session switch shows none.
export function FeedLoading({ state }: { state: 'loading' | 'running' }) {
  const { t } = useTranslation('sessions')
  return (
    <section className="feed-loading" data-state={state}>
      <Loader aria-label={t('feedLoading')} size="standard" />
    </section>
  )
}
