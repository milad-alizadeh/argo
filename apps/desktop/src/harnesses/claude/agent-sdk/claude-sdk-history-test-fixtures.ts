import { managedRosterRow } from '@/domains/sessions/contract/model/models'

export function managedClaudeSession(id: string) {
  return managedRosterRow({
    id,
    session: {
      harness: 'claude',
      cwd: '/repository',
      prompt: 'Continue old history',
      setup: { model: null, effort: null, mode: null },
      startedAt: new Date(1).toISOString(),
      status: 'running',
      compactionPercentage: null,
      compactionStartedAt: null,
      compactionTokens: null,
      handoffFailure: null,
      handoffStartedAt: null,
    },
  })
}
