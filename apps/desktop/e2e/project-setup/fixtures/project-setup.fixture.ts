import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect as baseExpect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright-core'
import { writeMockClaude } from '../../../mocks/cli/claude/mock-claude-cli'
import {
  SESSION_CLAUDE_EXECUTABLE_ENV,
  SESSION_CLAUDE_TRANSCRIPTS_ENV,
} from '../../../src/domains/sessions/main/composition/proof-protocol'
import { test as packagedTest } from '../../packaged-proof'
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
      application.process().stdout?.on('data', (chunk) => process.stdout.write(chunk))
      application.process().stderr?.on('data', (chunk) => process.stderr.write(chunk))
      const page = await application.firstWindow()
      page.setDefaultTimeout(30_000)
      await application.evaluate(({ BrowserWindow }, viewport) => {
        const window = BrowserWindow.getAllWindows()[0]
        window?.setContentSize(viewport.width, viewport.height)
        window?.hide()
      }, VIEWPORT)
      await page.waitForFunction(
        (viewport) =>
          window.innerWidth === viewport.width && window.innerHeight === viewport.height,
        VIEWPORT,
      )
      await page.waitForFunction(() => typeof window.argo?.projectSetupSnapshot === 'function')
      await use({ application, environment, fixture, page })
    } finally {
      await application.close()
    }
  },
})

export const expect = baseExpect.configure({ timeout: 30_000 })
