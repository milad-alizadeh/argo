import { useTranslation } from 'react-i18next'

type SessionStatusProps = { status: string }

type SessionStatusKey = 'status.active' | 'status.failed' | 'status.idle' | 'status.waiting'

const statusStyles: Record<string, string> = {
  active: 'bg-active text-canvas',
  idle: 'bg-muted text-canvas',
  waiting: 'bg-warn text-canvas',
  failed: 'bg-danger text-canvas',
}

const statusKeys: Record<string, SessionStatusKey> = {
  active: 'status.active',
  failed: 'status.failed',
  idle: 'status.idle',
  waiting: 'status.waiting',
}

export function SessionStatus({ status }: SessionStatusProps) {
  const { t } = useTranslation()
  const statusKey = statusKeys[status]

  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono type-label tracking-wide ${statusStyles[status] ?? 'bg-rule text-ink'}`}
    >
      {statusKey === undefined ? t('status.unknown', { status }) : t(statusKey)}
    </span>
  )
}
