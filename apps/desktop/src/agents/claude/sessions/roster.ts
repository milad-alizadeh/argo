import type { SessionChain } from '../../../core/sessions/chains'
import { projectRosterRow as project } from '../../../core/sessions/roster'

export * from '../../../core/sessions/roster'

export function projectRosterRow(chain: SessionChain) {
  return project(chain, 'claude')
}
