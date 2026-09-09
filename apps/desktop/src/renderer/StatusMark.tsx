import type { SessionStatus } from '../sessions/status'

// The word Argo has for what a Session is doing, drawn verbatim. `unknown` is a reading like any
// other and is shown as itself: the degrade-down rule exists so a fact Argo cannot establish is
// visible as unestablished rather than replaced by the nearest guess (ADR-0008). The status IS
// the word, so there is no table between the two to fall out of step with the vocabulary.
export function StatusMark({ status }: { status: SessionStatus }) {
  return (
    <span className="status-mark" data-status={status}>
      {status}
    </span>
  )
}
