import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect as baseExpect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright-core'
import {
  SESSION_CLAUDE_EXECUTABLE_ENV,
  SESSION_CLAUDE_TRANSCRIPTS_ENV,
} from '@/harnesses/proof-protocol'
import { writeMockClaude } from '../../../mocks/cli/claude/mock-claude-cli'
import { test as packagedTest } from '../../packaged-proof'
import { openHiddenWindow } from '../../packaged-window'
import { launch, prepareManual } from '../../projects/fixtures/project.fixture'

const VIEWPORT = { height: 860, width: 1440 }

type ProjectSetupRun = {
  application: ElectronApplication
  environment: Record<string, string>
  fixture: Awaited<ReturnType<typeof prepareManual>>
  page: Page
}

type ProjectSetupScenario = 'application-failure' | 'invalid' | 'permission' | 'questions' | 'ready'

export const test = packagedTest.extend<{
  projectSetup: ProjectSetupRun
  projectSetupScenario: ProjectSetupScenario
}>({
  projectSetupScenario: ['ready', { option: true }],
  projectSetup: async ({ packagedApplication, projectSetupScenario, root, setupDocument }, use) => {
    if (!setupDocument) throw new Error('The Project setup proof requires a setup document.')
    const fixture = await prepareManual(root, packagedApplication, setupDocument)
    const transcripts = path.join(root, 'claude-transcripts')
    await mkdir(transcripts, { recursive: true })
    const executable = await writeMockClaude(root, transcripts)
    const environment = {
      ARGO_PROJECT_SETUP_MOCK_SCENARIO: projectSetupScenario,
      [SESSION_CLAUDE_EXECUTABLE_ENV]: executable,
      [SESSION_CLAUDE_TRANSCRIPTS_ENV]: transcripts,
    }
    const application = await launch(fixture, environment)
    try {
      const page = await openHiddenWindow(application, VIEWPORT)
      await page.waitForFunction(() => typeof window.argo?.projectSetupSnapshot === 'function')
      await use({ application, environment, fixture, page })
    } finally {
      await application.close()
    }
  },
})

export const expect = baseExpect.configure({ timeout: 30_000 })
