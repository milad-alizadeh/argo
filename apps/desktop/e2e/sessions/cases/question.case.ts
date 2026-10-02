import { expect } from '@playwright/test'
import { fixtureSession } from '../fixture-sessions'
import { openSessionByRoute } from '../gestures'

// A stored Session holds no live channel, so its pending question draws locked (#2205).
export async function proveSessionQuestion(page) {
  await openSessionByRoute(page, await fixtureSession('askPending'))
  const history = page.getByRole('region', { name: 'Session history' })
  await history.getByText('Which ink?').waitFor()
  await history.getByText('This session is open in another app').waitFor()
  await expect(history.getByRole('radio')).toHaveCount(0)
  await expect(history.getByRole('button', { name: 'Send answer' })).toHaveCount(0)
}
