import { expect } from '@playwright/test'
import { fixtureSession } from '../fixture-sessions'
import { openSessionByRoute } from '../gestures'

// A stored Session that ends on a pending question draws it as a question row (#2959). It holds no
// live channel, so Argo cannot write an answer into it and the row draws locked, without choices
// to pick or an answer to send (#2205). The answerable path is proved live in `live-events.e2e.ts`.
export async function proveSessionQuestion(page) {
  await openSessionByRoute(page, await fixtureSession('askPending'))
  const history = page.getByRole('region', { name: 'Session history' })
  await history.getByText('Which ink?').waitFor()
  await history.getByText('This session is open in another app').waitFor()
  await expect(history.getByRole('radio')).toHaveCount(0)
  await expect(history.getByRole('button', { name: 'Send answer' })).toHaveCount(0)
}
