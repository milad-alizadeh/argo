import { LoaderCircle } from 'lucide-react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
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
        <StatusMark icon={LoaderCircle} label={t('workState.running')} className="animate-spin" />
      )
  }
}

function StatusMark({
  icon: Icon,
  label,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  className: string
}) {
  return (
    <>
      <Icon aria-hidden="true" className={`size-4 shrink-0 ${className}`} />
      <span className="sr-only">{label}</span>
    </>
  )
}

// Text for work still running carries the Feed's work shimmer.
export function RunningText({ running, children }: { running: boolean; children: string }) {
  return running ? <span className="feed-work-shimmer">{children}</span> : children
}
