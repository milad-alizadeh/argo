// One packaged launch per Harness readiness/sign-in scenario (#2579): Claude plays the state under
// test, Codex is pinned to `MISSING` so it never reads ready and the gate screen stays up
// regardless of which Claude state the case is proving.
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect as baseExpect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright-core'
import { writeMockClaudeReadinessCli } from '../../../mocks/cli/claude/mock-claude-readiness-cli'
import { writeMockCodexReadinessCli } from '../../../mocks/cli/codex/mock-codex-readiness-cli'
import type { MockSetupDocument } from '../../../mocks/providers/setup/mock-setup-document-loopback'
import {
  HARNESS_SIGNIN_CLAUDE_EXECUTABLE_ENV,
  HARNESS_SIGNIN_CODEX_EXECUTABLE_ENV,
  HARNESS_SIGNIN_EXPIRES_AFTER_MS_ENV,
} from '../../../src/domains/harness-signin/contract/proof-protocol'
import { createProjectStore } from '../../../src/domains/projects/main/sqlite-store'
import { sharedDatabasePath } from '../../../src/platform/main/storage/shared-database'
import { test as packagedTest } from '../../packaged-proof'
import { openHiddenWindow } from '../../packaged-window'
import {
  makeProjectLocallyReady,
  markProjectSetupLocallyReady,
} from '../../projects/fixtures/locally-ready-project'
import { launch, repository } from '../../projects/fixtures/project.fixture'

const PROOF_PROJECT_ID = 'harness-signin-project'

// `project.fixture.ts`'s own `prepare()` marks a Project locally runnable but not through setup, so
// the cockpit still routes it to `/setup` (#2326's Project contract cases want exactly that door
// open). This gate sits behind a Project setup has already finished, so this fixture also writes
// the setup checkpoint `markProjectSetupLocallyReady` leaves, and `launch()`'s own
// `fixture.setupDocument` wiring is what keeps `openProject`'s document-revision check from
// reopening setup on every launch.
async function prepareReadyProject(
  root: string,
  application: string,
  setupDocument: MockSetupDocument,
) {
  const userData = path.join(root, 'userData')
  const projectPath = path.join(root, 'example')
  await mkdir(userData, { recursive: true })
  await repository(projectPath)
  await makeProjectLocallyReady(projectPath)
  const databasePath = sharedDatabasePath(userData)
  const projects = createProjectStore(new DatabaseSync(databasePath))
  projects.replace({
    projects: [
      { id: PROOF_PROJECT_ID, path: projectPath, commonDirectory: path.join(projectPath, '.git') },
    ],
    selectedId: PROOF_PROJECT_ID,
  })
  markProjectSetupLocallyReady(projects, PROOF_PROJECT_ID, projectPath)
  projects.close()
  return { application, userData, setupDocument }
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
  harnessSignIn: async (
    { packagedApplication, harnessSignInScenario, root, setupDocument },
    use,
  ) => {
    if (!setupDocument) throw new Error('The Harness sign-in proof requires a setup document.')
    const fixture = await prepareReadyProject(root, packagedApplication, setupDocument)
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
