// What the Claude gate's own signal MEANS for a Session (CONTEXT.md L2 · Session status). Argo
// drives this Session itself, so the only managed reading it can make is whether a Permission is
// outstanding; `session-status-rollup.ts` folds the reading against the transcript-derived floor
// without learning that a gate exists.

import type { SessionStatus } from '@/domains/sessions/contract/model/models'

export function claudeManagedStatus(pendingPermission: boolean): SessionStatus {
  return pendingPermission ? 'permission' : 'running'
}
