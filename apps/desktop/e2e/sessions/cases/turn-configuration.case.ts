import { expect } from '@playwright/test'
import { chooseHarness, openNewSessionByClick, TURN_CONFIGURATION } from '../gestures'

export async function proveLiveCodexModelChoices(page) {
  await openNewSessionByClick(page)
  await chooseHarness(page, 'codex')
  await page.locator(TURN_CONFIGURATION).click()
  const models = page.getByRole('radiogroup', { name: 'Model' })
  await expect(models.getByRole('radio', { name: /GPT-5\.5/ })).toBeVisible()
  await expect(models.getByRole('radio', { name: /GPT-6-Astra/ })).toBeVisible()
  await expect(models.getByRole('radio')).toHaveCount(7)
  await expect(models.getByRole('radio', { name: /GPT-Reserve|Codex Auto Review/ })).toHaveCount(0)

  await models.getByText('GPT-5.5', { exact: true }).click()
  const effort = page.getByRole('slider', { name: 'Effort' })
  await expect(effort).toHaveAttribute('max', '3')

  await models.getByText('GPT-6-Astra', { exact: true }).click()
  await expect(effort).toHaveAttribute('max', '5')
  await effort.press('Home')
  await expect(effort).toHaveAccessibleName('Effort Low')
  await expect(effort).toHaveAttribute('aria-valuenow', '0')
  await effort.press('End')
  await expect(effort).toHaveAccessibleName('Effort Ultra')
  await expect(effort).toHaveAttribute('aria-valuenow', '5')

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
    page.getByRole('radiogroup', { name: 'Model' }).getByRole('radio', { name: /GPT-6-Astra/ }),
  ).toBeChecked()
  await expect(page.getByRole('slider', { name: 'Effort Ultra', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '5',
  )
}
