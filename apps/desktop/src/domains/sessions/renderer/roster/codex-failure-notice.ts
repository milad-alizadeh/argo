type PartialFailure = { harness: string }

type CodexFailureNotice = { description: string; title: string }

type Notify = (notice: CodexFailureNotice) => void

// The roster is mounted in several places. This process-wide latch prevents each consumer from
// turning the same Codex outage into another notification.
export function createCodexFailureNotice() {
  let emitted = false
  return (failures: readonly PartialFailure[], notice: CodexFailureNotice, notify: Notify) => {
    if (emitted || !failures.some((failure) => failure.harness === 'codex')) return
    emitted = true
    notify(notice)
  }
}

export const reportCodexFailure = createCodexFailureNotice()
