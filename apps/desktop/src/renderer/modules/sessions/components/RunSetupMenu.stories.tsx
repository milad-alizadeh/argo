import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'

import { CLAUDE_TURN_SETUP } from '../turn-setup/claude-turn-setup'
import { RunSetupMenu } from './RunSetupMenu'

function RunSetupStory() {
  const [setup, setSetup] = useState(CLAUDE_TURN_SETUP.opening)
  return (
    <div className="@container flex min-h-dvh max-w-4xl items-end p-8">
      <RunSetupMenu choices={CLAUDE_TURN_SETUP} value={setup} onChange={setSetup} />
      <output className="ml-4 text-sm" data-testid="chosen-setup">
        {`${setup.model} ${setup.effort}`}
      </output>
    </div>
  )
}

const meta: Meta<typeof RunSetupStory> = {
  title: 'Sessions/Run setup menu',
  component: RunSetupStory,
}

export default meta
type Story = StoryObj<typeof RunSetupStory>

const page = () => within(document.body)

const TRIGGER = /^Choose run setup/

export const ChoosesModelAndEffort: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })
    await expect(trigger).toHaveTextContent('Claude Code·Opus 5·Medium')
    await expect(trigger).toHaveAccessibleName('Choose run setup: Claude Code, Opus 5, Medium')

    await userEvent.click(trigger)
    const models = await page().findByRole('radiogroup', { name: 'Model' })
    const offered = within(models)
      .getAllByRole('radio')
      .map((option) => option.closest('label')?.textContent)
    await expect(offered).toEqual([
      'Fable 5.1',
      'Opus 5Most capable for architecture and hard problems',
      'Sonnet 5Balanced for daily coding and review',
      'Haiku 4.5Fast for small changes and quick answers',
    ])
    await userEvent.click(within(models).getByRole('radio', { name: /Sonnet 5/ }))
    await expect(within(models).getByRole('radio', { name: /Sonnet 5/ })).toBeChecked()

    const effort = page().getByRole('slider', { name: 'Effort' })
    await expect(effort).toHaveAttribute('aria-valuetext', 'Medium')
    // user-event cannot step a native range, so the drag lands as the change it produces.
    fireEvent.change(effort, { target: { value: '4' } })
    await expect(effort).toHaveAttribute('aria-valuetext', 'Max')
    fireEvent.change(effort, { target: { value: '3' } })
    await expect(effort).toHaveAttribute('aria-valuetext', 'Extra high')
    await expect(page().getByText('Extra high', { selector: 'span' })).toHaveClass('font-semibold')
    await expect(canvas.getByTestId('chosen-setup')).toHaveTextContent('sonnet xhigh')

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('radiogroup', { name: 'Model' })).toBeNull())
    await expect(trigger).toHaveFocus()
    await expect(trigger).toHaveTextContent('Claude Code·Sonnet 5·Extra high')
  },
}

export const ChoosesByKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: TRIGGER })

    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    const models = await page().findByRole('radiogroup', { name: 'Model' })
    await waitFor(() => expect(within(models).getByRole('radio', { name: /Opus 5/ })).toHaveFocus())

    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    const haiku = within(models).getByRole('radio', { name: /Haiku 4.5/ })
    await expect(haiku).toHaveFocus()
    await expect(haiku).toBeChecked()
    await expect(canvas.getByTestId('chosen-setup')).toHaveTextContent('haiku medium')
    await userEvent.tab()
    await expect(page().getByRole('slider', { name: 'Effort' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page().queryByRole('radiogroup', { name: 'Model' })).toBeNull())
    await expect(trigger).toHaveFocus()
  },
}
