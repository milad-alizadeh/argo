// One packaged launch per Harness readiness/sign-in scenario (#2579): Claude plays the state under
// test, Codex is pinned to `MISSING` so it never reads ready and the gate screen stays up
// regardless of which Claude state the case is proving.
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect as baseExpect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright-core'
import { openDatabase } from '@/database/database'
import { project } from '@/database/project/schema'
import {
  HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV,
  HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV,
  HARNESS_SIGNIN_EXPIRES_AFTER_MS_ENV,
} from '@/domains/harness-signin/contract/proof-protocol'
import { writeMockClaudeReadinessCli } from '../../../mocks/cli/claude/mock-claude-readiness-cli'
import { writeMockCodexReadinessCli } from '../../../mocks/cli/codex/mock-codex-readiness-cli'
import { test as packagedTest } from '../../packaged-proof'
import { openHiddenWindow } from '../../packaged-window'
import { makeProjectLocallyReady } from '../../projects/fixtures/locally-ready-project'
import { launch, repository } from '../../projects/fixtures/project.fixture'

const PROOF_PROJECT_ID = 'harness-signin-project'

async function prepareReadyProject(root: string, application: string) {
  const userData = path.join(root, 'userData')
  const projectPath = path.join(root, 'example')
  await mkdir(userData, { recursive: true })
  await repository(projectPath)
  await makeProjectLocallyReady(projectPath)
  const database = openDatabase(userData)
  database
    .insert(project)
    .values({
      id: PROOF_PROJECT_ID,
      path: projectPath,
      commonDirectory: path.join(projectPath, '.git'),
    })
    .run()
  database.$client.close()
  return { application, userData }
}

const VIEWPORT = { height: 860, width: 1440 }

export type HarnessSignInScenario =
  | 'missing'
  | 'signed-out'
  | 'ready'
  | 'policy-blocked'
  | 'canceled'
  | 'expired'

type HarnessSignInRun = {
  application: ElectronApplication
  page: Page
}

// `findExecutable` (both Harnesses' readiness modules) only substitutes its login-shell PATH
// lookup for a nullish override, so an override of `''` is what reads as `missing`: still a
// defined string, distinct from an unset env var that would fall through to whatever `claude`
// or `codex` happen to be on this machine's PATH.
const MISSING = ''

// Claude plays every state but `ready`, which Codex plays instead: that scenario alone proves the
// Codex side of the same proof-protocol seam, so the suite grounds both executable overrides
// rather than only Claude's. Whichever Harness is not under test is pinned to `MISSING`, so it
// always reads `missing` and the gate screen's outcome stays about the one under test.
async function environmentFor(
  root: string,
  scenario: HarnessSignInScenario,
): Promise<Record<string, string>> {
  switch (scenario) {
    case 'missing':
      return {
        [HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV]: MISSING,
        [HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV]: MISSING,
      }
    case 'ready':
      return {
        [HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV]: MISSING,
        [HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV]: await writeMockCodexReadinessCli(root),
        MOCK_CODEX_READINESS_STATE: 'ready',
      }
    case 'signed-out':
      return {
        [HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV]: await writeMockClaudeReadinessCli(root),
        [HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV]: MISSING,
        MOCK_CLAUDE_READINESS_STATE: 'signed-out',
      }
    case 'policy-blocked':
      return {
        [HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV]: await writeMockClaudeReadinessCli(root),
        [HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV]: MISSING,
        MOCK_CLAUDE_READINESS_STATE: 'policy-blocked',
      }
    case 'canceled':
      return {
        [HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV]: await writeMockClaudeReadinessCli(root),
        [HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV]: MISSING,
        MOCK_CLAUDE_READINESS_STATE: 'signed-out',
        MOCK_CLAUDE_READINESS_LOGIN_HANGS: '1',
      }
    case 'expired':
      return {
        [HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV]: await writeMockClaudeReadinessCli(root),
        [HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV]: MISSING,
        MOCK_CLAUDE_READINESS_STATE: 'signed-out',
        MOCK_CLAUDE_READINESS_LOGIN_HANGS: '1',
        // 0 makes the very next `wait` after `start` read expired unconditionally (`now() >=
        // expiresAt` where `expiresAt` was set to that same `now()`), with no real clock involved.
        [HARNESS_SIGNIN_EXPIRES_AFTER_MS_ENV]: '0',
      }
  }
}

export const test = packagedTest.extend<{
  harnessSignIn: HarnessSignInRun
  harnessSignInScenario: HarnessSignInScenario
}>({
  harnessSignInScenario: ['signed-out', { option: true }],
  harnessSignIn: async ({ packagedApplication, harnessSignInScenario, root }, use) => {
    const fixture = await prepareReadyProject(root, packagedApplication)
    const environment = await environmentFor(root, harnessSignInScenario)
    const application = await launch(fixture, environment)
    try {
      const page = await openHiddenWindow(application, VIEWPORT)
      await use({ application, page })
    } finally {
      await application.close()
    }
  },
})

export const expect = baseExpect.configure({ timeout: 30_000 })
