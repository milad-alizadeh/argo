import { expect, test } from 'vitest'
import { createCodexFailureNotice } from './codex-failure-notice'

test('reports one Codex outage when multiple roster consumers receive the same failure', () => {
  const report = createCodexFailureNotice()
  const notices: Array<{ description: string; title: string }> = []
  const notice = {
    title: 'Codex Sessions did not load',
    description: 'Another Codex app is using the database. Close it, then retry.',
  }
  const notify = (nextNotice: { description: string; title: string }) => notices.push(nextNotice)
  const failures = [{ harness: 'codex' }]

  report(failures, notice, notify)
  report(failures, notice, notify)
  report(failures, notice, notify)

  expect(notices).toEqual([notice])
})
