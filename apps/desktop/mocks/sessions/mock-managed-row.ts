import { managedRow } from '../../src/core/sessions/managed-row'
import type { SessionRosterRow, SessionStatus } from '../../src/core/sessions/models'

const setup = { model: null, effort: null, mode: null } as const

export function mockManagedRow(id: string, status: SessionStatus): SessionRosterRow {
  return managedRow(id, {
    cli: 'claude',
    compactionPercentage: null,
    compactionStartedAt: null,
    compactionTokens: null,
    cwd: '/projects/argo',
    status,
    setup,
    prompt: 'Do the thing.',
    startedAt: '2026-09-14T00:00:00.000Z',
  })
}
