import { useTranslation } from 'react-i18next'

type SessionStatusProps = { status: string }

type SessionStatusKey = 'status.active' | 'status.failed' | 'status.idle' | 'status.waiting'

const statusStyles: Record<string, string> = {
  active: 'bg-active text-background',
  idle: 'bg-muted text-background',
  waiting: 'bg-warn text-background',
  failed: 'bg-danger text-background',
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
      className={`rounded-full px-2 py-0.5 font-mono type-label tracking-wide ${statusStyles[status] ?? 'bg-border text-foreground'}`}
    >
      {statusKey === undefined ? t('status.unknown', { status }) : t(statusKey)}
    </span>
  )
}
