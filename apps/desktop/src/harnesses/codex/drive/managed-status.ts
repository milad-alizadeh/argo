// What codex app-server's own status words MEAN for a Session (CONTEXT.md L2 · Session status).
// The wire vocabulary stops here: this adapter translates it into one reading from core's closed
// set, and `session-status-rollup.ts` folds that reading against the transcript-derived floor
// without ever learning a Codex word.

import type { SessionStatus } from '@/domains/sessions/contract/model'

// The wire's own thread-status shape (`thread/status/changed`), read raw by `protocol.ts`, which
// validates the shape and leaves the meaning to this module.
export type CodexThreadStatus =
  | { type: 'active'; activeFlags: readonly string[] }
  | { type: 'idle' }
  | { type: 'systemError' | 'notLoaded' }

export type CodexStatusReading =
  | { kind: 'thread'; status: CodexThreadStatus }
  // The protocol has spoken, but not into a word Argo's closed set can stand behind.
  | { kind: 'turn-failed' }

function threadStatus(status: CodexThreadStatus): SessionStatus {
  switch (status.type) {
    case 'active':
      if (status.activeFlags.includes('waitingOnApproval')) return 'permission'
      if (status.activeFlags.includes('waitingOnUserInput')) return 'asking'
      return 'running'
    case 'idle':
      return 'idle'
    case 'systemError':
    case 'notLoaded':
      return 'unknown'
  }
}

export function codexManagedStatus(reading: CodexStatusReading): SessionStatus {
  switch (reading.kind) {
    case 'turn-failed':
      return 'unknown'
    case 'thread':
      return threadStatus(reading.status)
  }
}
