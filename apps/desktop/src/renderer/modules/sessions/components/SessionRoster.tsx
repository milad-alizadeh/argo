import type { Session, SessionId } from '../types'

import { SessionList } from './SessionList'

type SessionRosterProps = { sessions: readonly Session[]; selectedSessionId: SessionId | null; onSelect: (sessionId: SessionId) => void }

export function SessionRoster({ sessions, selectedSessionId, onSelect }: SessionRosterProps) {
  return (
    <aside className="flex min-h-0 flex-col border-r border-rule bg-panel">
      <header className="border-b border-rule px-4 py-4"><h1 className="font-mono text-sm font-semibold tracking-wide">Sessions</h1><p className="mt-1 text-sm text-muted">Claude terminal activity</p></header>
      <div className="min-h-0 flex-1 overflow-y-auto"><SessionList onSelect={onSelect} selectedSessionId={selectedSessionId} sessions={sessions} /></div>
    </aside>
  )
}
