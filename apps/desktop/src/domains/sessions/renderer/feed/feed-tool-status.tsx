import { useTranslation } from 'react-i18next'
import { Loader } from '../../../../platform/renderer/components/loader'
import type { SessionFeedRow } from '../types'

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

// Text for work still running carries the Feed's work shimmer.
export function RunningText({ running, children }: { running: boolean; children: string }) {
  return running ? <span className="feed-work-shimmer">{children}</span> : children
}
