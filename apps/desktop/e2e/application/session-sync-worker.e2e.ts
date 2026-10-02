import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { _electron as electron } from 'playwright-core'
import type { SessionSyncStatus } from '@/domains/sessions/main/session-sync-status'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/harnesses/codex/proof-protocol'
import { PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { closeApplication, launchCommand } from '../application-under-test'
import { expect, test } from '../packaged-proof'

test('starts and stops the packaged Session sync worker', async ({
  applicationUnderTest,
  root,
}) => {
  const userData = path.join(root, 'session-sync-user-data')
  const claudeConfig = path.join(root, 'claude-config')
  const codexHome = path.join(root, 'codex-home')
  await Promise.all([userData, claudeConfig, codexHome].map((directory) => mkdir(directory)))
  const application = await electron.launch({
    ...launchCommand(applicationUnderTest),
    env: {
      ...process.env,
      [PROJECT_PROOF_STORE_ENV]: userData,
      CLAUDE_CONFIG_DIR: claudeConfig,
      CODEX_HOME: codexHome,
      // Every machine scans as the CI runner does: no Codex installed.
      [SESSION_CODEX_EXECUTABLE_ENV]: '',
    },
    timeout: 30_000,
  })
  try {
    const page = await application.firstWindow()
    await page.waitForFunction(() => typeof window.argo?.trpcSubscribe === 'function')
    // The whole status, so a failed scan names its failure.
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const id = Math.floor(Math.random() * 1_000_000_000)
            return await new Promise<SessionSyncStatus | null>((resolve) => {
              let stop = () => {}
              void window.argo
                .trpcSubscribe(
                  { id, path: 'sessionSyncStatus', type: 'subscription', input: null },
                  (message) => {
                    if (message.id !== id || message.type !== 'data') return
                    stop()
                    resolve((message.result.data as { status: SessionSyncStatus }).status)
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
      .toMatchObject({ phase: 'ready', failure: null })
  } finally {
    await closeApplication(application)
  }
})
