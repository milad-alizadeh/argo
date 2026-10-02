import * as React from 'react'
import { SessionRow } from '@/domains/sessions/renderer/session-list/session-row'
import type { Session, SessionId } from '@/domains/sessions/renderer/types'
import type { WorkEntry } from '@/domains/sessions/renderer/work/session-work-entries'
import { SessionWorkMenu } from '@/domains/sessions/renderer/work/session-work-menu'
import { sessionRow } from '@/mocks/sessions/session-rows'

export const SESSION_STATUS_NAMES: Record<Session['status'], string> = {
  running: 'Working Session',
  starting: 'Starting Session',
  asking: 'Question Session',
  permission: 'Permission Session',
  ended: 'Ended Session',
  stopped: 'Stopped Session',
  unknown: 'Unknown Session',
  idle: 'Idle Session',
}

export function SessionToneSamples({
  onSelect = () => {},
}: {
  onSelect?: (id: SessionId) => void
}) {
  return (
    <div className="w-80">
      {(Object.entries(SESSION_STATUS_NAMES) as [Session['status'], string][]).map(
        ([status, name]) => (
          <SessionRow
            checked={false}
            key={status}
            now={Date.parse('2026-09-01T00:00:00Z')}
            onFocus={() => {}}
            onSelect={onSelect}
            onToggleSelect={() => {}}
            selected={false}
            session={sessionRow({ id: status, name, status })}
            tabbable
            unavailable={false}
          />
        ),
      )}
    </div>
  )
}

function countEntry(running: boolean): WorkEntry {
  return {
    id: running ? 'running-work' : 'finished-work',
    title: running ? 'Review interface' : 'Review complete',
    monospace: false,
    status: running ? 'running' : 'completed',
    mark: 'bg-current',
    state: running ? 'Running' : 'Done',
    facts: '',
  }
}

export function WorkCountSamples() {
  const [picked, setPicked] = React.useState<string | null>(null)
  return (
    <div className="flex items-center gap-4">
      {[true, false].map((running) => (
        <SessionWorkMenu
          entries={[countEntry(running)]}
          icon="agent"
          key={String(running)}
          label={running ? 'Running work' : 'Finished work'}
          onSelect={setPicked}
          selectedId={picked}
        />
      ))}
      <output aria-label="Selected work">{picked ?? 'None'}</output>
    </div>
  )
}
