import type { BrowserContext, Locator, Page } from 'playwright-core'
import { openDatabase } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { expect, finishRecording, startRecording, test } from '../packaged-proof'
import { launch, prepare } from '../projects/fixtures/project.fixture'

const SELECTED_ID = '00000000-0000-4000-8000-000000000001'

function savedSessions() {
  return Array.from({ length: 31 }, (_, index) => {
    const pagePosition = index + 1
    const argoId = `00000000-0000-4000-8000-${String(pagePosition).padStart(12, '0')}`
    if (pagePosition === 1) {
      return {
        argoId,
        harness: 'claude',
        nativeId: 'shared-native-id',
        projectId: 'project-1',
        customTitle: 'Custom title',
        preview: 'Older summary',
        firstPrompt: 'Ignored first prompt',
      }
    }
    if (pagePosition === 2) {
      return {
        argoId,
        harness: 'codex',
        nativeId: 'shared-native-id',
        projectId: 'project-1',
        preview: 'Vendor preview',
        firstPrompt: 'Ignored first prompt',
      }
    }
    return {
      argoId,
      harness: 'claude',
      nativeId: `native-${pagePosition}`,
      projectId: 'project-1',
      firstPrompt: pagePosition === 3 ? 'First prompt' : `Saved Session ${pagePosition}`,
    }
  })
}

function addSavedSession(userData: string) {
  const database = openDatabase(userData)
  database
    .insert(sessionTable)
    .values({
      argoId: '00000000-0000-4000-8000-000000000000',
      harness: 'claude',
      nativeId: 'newly-saved',
      projectId: 'project-1',
      firstPrompt: 'New saved Session',
    })
    .run()
  database.$client.close()
}

async function verifyTitleSearch(page: Page, sessionList: Locator) {
  const search = page.getByRole('textbox', { name: 'Search Sessions' })
  await search.fill('vendor preview')
  await expect(page.getByRole('button', { name: /Vendor preview/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Custom title/ })).toHaveCount(0)
  await expect(sessionList).toHaveAttribute('data-total', '1')
  await search.clear()
  await expect(sessionList).toHaveAttribute('data-total', '31')
}

test('shows saved numbered pages and keeps Argo-ID selection', async ({
  root,
  packagedApplication,
  performanceProfile,
}, testInfo) => {
  const fixture = await prepare(root, packagedApplication)
  const seeded = openDatabase(fixture.userData)
  seeded
    .insert(project)
    .values({ id: 'project-2', path: fixture.beta, commonDirectory: `${fixture.beta}/.git` })
    .run()
  seeded.insert(sessionTable).values(savedSessions()).run()
  seeded
    .insert(sessionTable)
    .values({
      argoId: '00000000-0000-4000-8000-999999999999',
      harness: 'claude',
      nativeId: 'other-project',
      projectId: 'project-2',
      customTitle: 'Other Project Session',
    })
    .run()
  seeded.$client.close()

  const application = await launch(fixture, { PATH: '/usr/bin:/bin' })
  let traced: BrowserContext | undefined
  try {
    const page = await application.firstWindow()
    traced = await startRecording(performanceProfile, application, async () => page)
    const sessionList = page.getByRole('complementary', { name: 'Sessions' })
    await expect(page.getByRole('button', { name: /Custom title/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Vendor preview/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /First prompt/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Other Project Session/ })).toHaveCount(0)
    await expect(sessionList).toHaveAttribute('data-page-count', '1')
    await expect(sessionList).toHaveAttribute('data-total', '31')
    await verifyTitleSearch(page, sessionList)
    await page.locator('[data-slot="session-list-scroll"]').evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect(page.getByRole('button', { name: /Saved Session 31/ })).toBeVisible()
    await expect(sessionList).toHaveAttribute('data-page-count', '2')
    await expect(sessionList).toHaveAttribute('data-total', '31')

    await page.getByRole('button', { name: /Custom title/ }).click()
    await expect(page).toHaveURL(new RegExp(`/sessions/${SELECTED_ID}$`))

    addSavedSession(fixture.userData)

    await page.reload()
    await expect(page.locator(`[data-session-id="${SELECTED_ID}"]`)).toHaveAttribute(
      'aria-current',
      'page',
    )
    await finishRecording(performanceProfile, traced, testInfo)
  } finally {
    await performanceProfile?.stop()
    // This proof covers a window read, not macOS shutdown, so stop its isolated app copy directly.
    application.process().kill('SIGKILL')
  }
})
