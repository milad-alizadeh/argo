import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { claudeComposerModelCatalogFixture } from '@/mocks/sessions/claude-model-catalog.fixture'
import { claudeChoices } from '@/mocks/sessions/harness-catalog.fixture'
import { Button } from '@/platform/renderer/components/ui/button'
import type { TurnConfigurationChoices } from '../turn-configuration/turn-configuration'
import { ModeMenu } from './mode-menu'

const CLAUDE_TURN_CONFIGURATION = (() => {
  const choices = claudeChoices(claudeComposerModelCatalogFixture())
  if (choices === null) throw new Error('The Claude story catalog has no usable model.')
  return choices
})() satisfies TurnConfigurationChoices

function ModeStory({
  narrow = false,
  nextControl = false,
}: {
  narrow?: boolean
  nextControl?: boolean
}) {
  const [turnConfiguration, setTurnConfiguration] = useState(CLAUDE_TURN_CONFIGURATION.opening)
  return (
    <div className={`@container flex min-h-dvh items-end p-8 ${narrow ? 'w-72' : 'max-w-4xl'}`}>
      <ModeMenu
        choices={CLAUDE_TURN_CONFIGURATION}
        value={turnConfiguration}
        onChange={setTurnConfiguration}
      />
      {nextControl ? <Button>Send message</Button> : null}
    </div>
  )
}

function AutoRestrictedModeStory() {
  const choices = claudeChoices(claudeComposerModelCatalogFixture())
  if (choices === null) throw new Error('The Claude story catalog has no usable model.')
  const [turnConfiguration, setTurnConfiguration] = useState({
    model: 'sonnet',
    effort: 'medium',
    mode: 'manual',
  })
  return (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <ModeMenu choices={choices} value={turnConfiguration} onChange={setTurnConfiguration} />
    </div>
  )
}

const meta = {
  title: 'Features/Sessions/Composer/Mode Menu',
  component: ModeStory,
} satisfies Meta<typeof ModeStory>

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
      'ManualAsk before making changes',
      'Accept editsAccept file edits automatically',
      'PlanCreate a plan before making changes',
      'AutoClaude handles permission decisions',
      "Don't askDeny anything not approved in advance",
      'BypassRun without permission checks',
    ])
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: /Bypass/ }))
    await waitFor(() => expect(page().queryByRole('menu')).toBeNull())
    await expect(trigger).toHaveTextContent('Bypass')
    await expect(trigger).toHaveAccessibleName('Choose permission mode: Bypass')
    await expect(trigger).toHaveFocus()
  },
}

export const HidesAutoWhenTheModelDoesNotSupportIt: Story = {
  render: () => <AutoRestrictedModeStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /^Choose permission mode/ })
    await expect(trigger).toHaveTextContent('Manual')
    await userEvent.click(trigger)
    const menu = await page().findByRole('menu')
    await expect(within(menu).queryByRole('menuitemradio', { name: /Auto/ })).toBeNull()
    await expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(5)
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
  },
}

export const NarrowMenu: Story = {
  args: { narrow: true },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', {
      name: 'Choose permission mode: Manual',
    })
    await userEvent.click(trigger)
    await expect(
      await page().findByRole('menuitemradio', {
        name: /Don't ask.*Deny anything not approved in advance/,
      }),
    ).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('menu')).toBeNull())
    await expect(trigger).toHaveFocus()
  },
}

export const KeyboardDismissal: Story = {
  args: { nextControl: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Choose permission mode: Manual' })
    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}')
    await expect(await page().findByRole('menuitemradio', { name: /Manual/ })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('menu')).toBeNull())
    await expect(trigger).toHaveFocus()
    await userEvent.click(trigger)
    await userEvent.tab()
    await waitFor(() => expect(page().queryByRole('menu')).toBeNull())
    await expect(canvas.getByRole('button', { name: 'Send message' })).toHaveFocus()
  },
}
