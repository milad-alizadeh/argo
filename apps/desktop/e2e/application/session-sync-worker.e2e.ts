import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { _electron as electron } from 'playwright-core'
import { PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { launchCommand } from '../application-under-test'
import { expect, test } from '../packaged-proof'

test('starts and stops the packaged Session sync worker', async ({
  applicationUnderTest,
  root,
}) => {
  const userData = path.join(root, 'session-sync-user-data')
  await mkdir(userData, { recursive: true })
  const application = await electron.launch({
    ...launchCommand(applicationUnderTest),
    env: { ...process.env, [PROJECT_PROOF_STORE_ENV]: userData },
    timeout: 30_000,
  })
  try {
    const page = await application.firstWindow()
    await page.waitForFunction(() => typeof window.argo?.trpcSubscribe === 'function')
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const id = Math.floor(Math.random() * 1_000_000_000)
            return await new Promise<string | null>((resolve) => {
              let stop = () => {}
              void window.argo
                .trpcSubscribe(
                  { id, path: 'sessionSyncStatus', type: 'subscription', input: null },
                  (message) => {
                    if (message.id !== id || message.type !== 'data') return
                    stop()
                    resolve((message.result.data as { status: { phase: string } }).status.phase)
                  },
                )
                .then((unsubscribe) => {
                  stop = unsubscribe
                })
                .catch(() => resolve(null))
            })
          }),
        { timeout: 10_000 },
      )
      .toBe('ready')
    await page.close()
  } finally {
    await application.close()
  }
})
