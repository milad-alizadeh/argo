import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
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
    await expect
      .poll(
        () => {
          const client = new DatabaseSync(path.join(userData, 'argo.sqlite'))
          try {
            const row = client
              .prepare("SELECT phase FROM session_sync_status WHERE harness = 'claude'")
              .get()
            return row?.phase ?? null
          } catch {
            return null
          } finally {
            client.close()
          }
        },
        { timeout: 10_000 },
      )
      .toBe('ready')
    await page.close()
  } finally {
    await application.close()
  }
})
