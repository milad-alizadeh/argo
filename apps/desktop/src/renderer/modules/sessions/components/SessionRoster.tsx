import { useTranslation } from 'react-i18next'

import type { Session, SessionId } from '../types'

import { SessionList } from './SessionList'

type SessionRosterProps = {
  sessions: readonly Session[]
  selectedSessionId: SessionId | null
  onSelect: (sessionId: SessionId) => void
  onRefresh: () => void
}

export function SessionRoster({
  sessions,
  selectedSessionId,
  onSelect,
  onRefresh,
}: SessionRosterProps) {
  const { t } = useTranslation()

  return (
    <aside className="flex min-h-0 flex-col border-r border-rule bg-panel">
      <header className="border-b border-rule px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-mono text-sm font-semibold tracking-wide">{t('title')}</h1>
          <button
            className="font-mono text-xs text-muted underline underline-offset-4 hover:text-ink"
            onClick={onRefresh}
            type="button"
          >
            {t('readAgain')}
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SessionList
          onSelect={onSelect}
          selectedSessionId={selectedSessionId}
          sessions={sessions}
        />
      </div>
    </aside>
  )
}
