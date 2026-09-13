import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { CLAUDE_TURN_SETUP } from '../turn-setup/claude-turn-setup'
import { ModeMenu } from './ModeMenu'

function ModeStory() {
  const [setup, setSetup] = useState(CLAUDE_TURN_SETUP.opening)
  return (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <ModeMenu choices={CLAUDE_TURN_SETUP} value={setup} onChange={setSetup} />
      <output hidden data-testid="chosen-mode">
        {setup.mode}
      </output>
    </div>
  )
}

const meta: Meta<typeof ModeStory> = {
  title: 'Sessions/Composer/Mode Menu',
  component: ModeStory,
}

export default meta
type Story = StoryObj<typeof ModeStory>

const page = () => within(document.body)

export const OffersEveryMode: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /^Choose permission mode/ })
    await expect(trigger).toHaveTextContent('Manual')
    await expect(trigger).toHaveAccessibleName('Choose permission mode: Manual')

    await userEvent.click(trigger)
    const menu = await page().findByRole('menu')
    await expect(within(menu).getByRole('menuitemradio', { name: /Manual/ })).toBeChecked()
    await expect(menu).toHaveTextContent('Claude Code permissions')
    await expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual([
      'AutoClaude handles permission decisions',
      'ManualAsk before making changes',
      'Accept editsAccept file edits automatically',
      'PlanCreate a plan before making changes',
      "Don't askDeny anything not approved in advance",
      'BypassRun without permission checks',
    ])
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: /Bypass/ }))
    await waitFor(() => expect(page().queryByRole('menu')).toBeNull())
    await expect(trigger).toHaveTextContent('Bypass')
    await expect(trigger).toHaveAccessibleName('Choose permission mode: Bypass')
    await expect(canvas.getByTestId('chosen-mode')).toHaveTextContent('bypassPermissions')
  },
}

export const ChoosesByKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /^Choose permission mode/ })

    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    const menu = await page().findByRole('menu')
    const plan = within(menu).getByRole('menuitemradio', { name: /Plan/ })
    for (let step = 0; step < 6 && document.activeElement !== plan; step++)
      await userEvent.keyboard('{ArrowDown}')
    await expect(plan).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(page().queryByRole('menu')).toBeNull())
    await expect(trigger).toHaveFocus()
    await expect(trigger).toHaveTextContent('Plan')
    await expect(canvas.getByTestId('chosen-mode')).toHaveTextContent('plan')
  },
}
