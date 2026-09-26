import type { BrowserContext } from 'playwright-core'
import { openDatabase } from '@/database/database'
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
        customTitle: 'Custom title',
        preview: 'Ignored vendor preview',
        firstPrompt: 'Ignored first prompt',
      }
    }
    if (pagePosition === 2) {
      return {
        argoId,
        harness: 'codex',
        nativeId: 'shared-native-id',
        preview: 'Vendor preview',
        firstPrompt: 'Ignored first prompt',
      }
    }
    return {
      argoId,
      harness: 'claude',
      nativeId: `native-${pagePosition}`,
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
      firstPrompt: 'New saved Session',
    })
    .run()
  database.$client.close()
}

test('shows saved numbered pages and keeps Argo-ID selection', async ({
  root,
  packagedApplication,
  performanceProfile,
}, testInfo) => {
  const fixture = await prepare(root, packagedApplication)
  const seeded = openDatabase(fixture.userData)
  seeded.insert(sessionTable).values(savedSessions()).run()
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
    await expect(sessionList).toHaveAttribute('data-page-count', '1')
    await expect(sessionList).toHaveAttribute('data-total', '31')
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
