// The Session status ROLLUP (CONTEXT.md L2 · Session status): the one fold every call site that
// computes a Session's status goes through, instead of each restating its own fragment of the
// honesty-tier rule. It takes the transcript-derived floor (`readExternalStatus` in status.ts),
// the Session's posture, and a managed-only CLI signal, and returns the one SessionStatus.
//
// The tie-break is the degrade-down rule made concrete: `permission` is DIRECT and managed-only,
// so it always wins. Any other managed reading only wins where the floor itself has nothing to
// say (`unknown`) — nothing observed is a different claim from observed to be quiet, and a
// definite floor (`idle`, `asking`, `stopped`) is never overridden by a managed `running` just
// because it is held.

import type { SessionPosture, SessionStatus } from './models'

// The wire's own thread-status shape (codex app-server's `thread/status/changed`), read raw:
// this fold owns the one decision of what each shape MEANS, so `protocol.ts` only validates and
// hands the shape over rather than pre-deciding a SessionStatus the fold cannot then reconcile.
export type CodexThreadStatus =
  | { type: 'active'; activeFlags: readonly string[] }
  | { type: 'idle' }
  | { type: 'systemError' | 'notLoaded' }

export type CodexStatusReading =
  | { kind: 'thread'; status: CodexThreadStatus }
  | { kind: 'turn-failed' }

export type ManagedStatusSignal =
  | { kind: 'claude'; pendingPermission: boolean }
  | { kind: 'codex'; reading: CodexStatusReading }
  // Already-derived: a caller (managed-row.ts) reconciling two rows that each ran their own CLI
  // signal through this fold once already needs no second derivation, only the tie-break.
  | { kind: 'already'; status: SessionStatus }

function deriveCodexThreadStatus(status: CodexThreadStatus): SessionStatus {
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

function deriveManagedStatus(signal: ManagedStatusSignal): SessionStatus {
  switch (signal.kind) {
    case 'already':
      return signal.status
    case 'claude':
      return signal.pendingPermission ? 'permission' : 'running'
    case 'codex':
      // A failed Turn is a degrade-down case, not a one-off exception: the protocol has spoken,
      // but not into a word this fold's closed set can stand behind.
      switch (signal.reading.kind) {
        case 'turn-failed':
          return 'unknown'
        case 'thread':
          return deriveCodexThreadStatus(signal.reading.status)
      }
  }
}

export function rollupSessionStatus(
  floor: SessionStatus,
  posture: SessionPosture,
  signal: ManagedStatusSignal | null,
): SessionStatus {
  if (posture !== 'managed' || signal === null) return floor
  const managed = deriveManagedStatus(signal)
  return managed === 'permission' || floor === 'unknown' ? managed : floor
}
