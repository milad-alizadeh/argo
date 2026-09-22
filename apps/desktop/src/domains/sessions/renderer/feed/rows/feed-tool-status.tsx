import { useTranslation } from 'react-i18next'
import type { SessionFeedRow } from '../../types'
import { Loader } from '@/platform/renderer/components/loader'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>

export function StatusIcon({ status }: { status: ToolRow['status'] }) {
  const { t } = useTranslation('sessions')
  switch (status) {
    case 'failed':
    case 'succeeded':
      return null
    case 'running':
      return (
        <>
          <Loader aria-hidden={true} />
          <span className="sr-only">{t('workState.running')}</span>
        </>
      )
  }
}
