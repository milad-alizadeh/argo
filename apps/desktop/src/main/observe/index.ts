import { homedir } from 'node:os'
import { join } from 'node:path'

export { parseTranscript } from './claudeTranscript'
export { discoverWorkingSet, selectWorkingSet, WORKING_SET_WINDOW_MS } from './discover'
export { gatherClaudeProcesses } from './liveness'
export { createManagedSessions, type ManagedSessions } from './managed'
export {
  type GradeStatus,
  toObservedSession,
  toSessionEvent,
  toSessionUpdate,
} from './observedSession'
export {
  createObserver,
  type Observer,
  type ObserverOptions,
  PROCESS_PROBE_TTL_MS,
} from './observer'
export { latestInChain, stitch } from './resumeChain'
export { deriveSessionStatus, RECENT_ACTIVITY_MS, type StatusSignals } from './sessionStatus'
export { ASK_TOOL, DELEGATING_TOOLS, PLAN_TOOL } from './toolCalls'
export { createTreeBuilder, type ParsedTree } from './tree'
export type * from './types'
export { CHANGE_DEBOUNCE_MS, watchTranscripts } from './watch'

// Where the CLI keeps its transcripts. Overridable so a test — or the packaged e2e run, which
// needs a deterministic world rather than whatever this machine has been doing — can point the
// observer at a fixture root instead of the developer's own history.
export const TRANSCRIPT_ROOT_ENV = 'ARGO_TRANSCRIPT_ROOT'

export function transcriptRoot(env: Record<string, string | undefined>): string {
  return env[TRANSCRIPT_ROOT_ENV] ?? join(homedir(), '.claude', 'projects')
}
