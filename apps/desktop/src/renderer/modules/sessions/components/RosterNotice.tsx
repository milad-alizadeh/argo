import { CircleAlertIcon, RefreshCwIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function RosterNotice({ failure, onReread }: { failure: string; onReread: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="session-page__roster-notice" data-component="RosterNotice" role="alert">
      <strong>
        <CircleAlertIcon aria-hidden="true" />
        {t('errors.roster')}
      </strong>
      <span>{failure}</span>
      <button onClick={onReread} type="button">
        <RefreshCwIcon aria-hidden="true" />
        {t('readAgain')}
      </button>
    </div>
  )
}
