import { expect } from '@playwright/test'
import { chooseHarness, openNewSessionByClick, TURN_CONFIGURATION } from '../gestures'

export async function proveLiveCodexModelChoices(page) {
  await openNewSessionByClick(page)
  await chooseHarness(page, 'codex')
  await page.locator(TURN_CONFIGURATION).click()
  const models = page.getByRole('radiogroup', { name: 'Model' })
  await expect(models.getByRole('radio', { name: /Mock Haiku/ })).toBeVisible()
  await expect(models.getByRole('radio', { name: /Mock Opus/ })).toBeVisible()
  await expect(models.getByRole('radio', { name: /Hidden mock model/ })).toHaveCount(0)

  await models.getByText('Mock Haiku', { exact: true }).click()
  const effort = page.getByRole('slider', { name: 'Effort' })
  await expect(effort).toHaveAttribute('max', '1')

  await models.getByText('Mock Opus', { exact: true }).click()
  await expect(effort).toHaveAttribute('max', '2')
  await expect(effort).toHaveAttribute('aria-valuetext', /^(Medium|High|Extra high)$/)
  await expect(page.getByText('Low', { exact: true })).toHaveCount(0)
  await effort.press('End')
  await expect(effort).toHaveAttribute('aria-valuetext', 'Extra high')

  await page.getByRole('tab', { name: 'Claude Code' }).click()
  await expect(
    page.getByRole('radiogroup', { name: 'Model' }).getByRole('radio', { name: /Sonnet/ }),
  ).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'Model' }).getByRole('radio')).toHaveCount(4)
  await expect(
    page.getByRole('radiogroup', { name: 'Model' }).getByRole('radio', { name: 'Opus 5' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')

  await openNewSessionByClick(page)
  await chooseHarness(page, 'codex')
  await page.locator(TURN_CONFIGURATION).click()
  await expect(
    page.getByRole('radiogroup', { name: 'Model' }).getByRole('radio', { name: /Mock Opus/ }),
  ).toBeChecked()
  await expect(page.getByRole('slider', { name: 'Effort' })).toHaveAttribute(
    'aria-valuetext',
    'Extra high',
  )
}
